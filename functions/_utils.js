export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

export function getCurrentTime() {
  return new Date().toISOString();
}

export async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

export async function parseFormData(request) {
  try {
    return await request.formData();
  } catch (e) {
    return null;
  }
}

export async function queryDB(env, sql, params = []) {
  try {
    const stmt = env.DB.prepare(sql);
    return params.length > 0 ? await stmt.bind(...params).run() : await stmt.run();
  } catch (error) {
    console.error('DB Error:', error);
    throw error;
  }
}

export async function queryAll(env, sql, params = []) {
  try {
    const stmt = env.DB.prepare(sql);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
    return result.results || [];
  } catch (error) {
    console.error('DB Error:', error);
    throw error;
  }
}

export async function queryOne(env, sql, params = []) {
  try {
    const stmt = env.DB.prepare(sql);
    const result = params.length > 0 ? await stmt.bind(...params).first() : await stmt.first();
    return result;
  } catch (error) {
    console.error('DB Error:', error);
    throw error;
  }
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateId() {
  return crypto.randomUUID();
}

export function generateUserId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const CHUNK_SIZE = 512 * 1024;

export async function writeFileInChunks(env, fileId, fileType, fileData) {
  let buffer;
  if (fileData && typeof fileData.arrayBuffer === 'function') {
    buffer = await fileData.arrayBuffer();
  } else if (fileData instanceof ArrayBuffer) {
    buffer = fileData;
  } else if (fileData instanceof Uint8Array) {
    buffer = fileData.buffer;
  } else {
    buffer = new ArrayBuffer(0);
  }

  const totalSize = buffer.byteLength;
  const totalChunks = Math.max(1, Math.floor((totalSize + CHUNK_SIZE - 1) / CHUNK_SIZE));
  const created_at = getCurrentTime();

  const statements = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunk = new Uint8Array(buffer, start, end - start);
    const chunkId = generateId();
    statements.push({
      sql: 'INSERT INTO file_chunks (id, file_id, file_type, chunk_index, chunk_data, chunk_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [chunkId, fileId, fileType, i, chunk, chunk.byteLength, created_at],
    });
  }

  if (statements.length === 1) {
    await queryDB(env, statements[0].sql, statements[0].params);
  } else {
    const tx = env.DB.transaction(statements.map(s => env.DB.prepare(s.sql).bind(...s.params)));
    await tx.run();
  }
}

export async function readFileFromChunks(env, fileId, fileType) {
  try {
    const chunks = await queryAll(env,
      'SELECT chunk_data, chunk_size FROM file_chunks WHERE file_id = ? AND file_type = ? ORDER BY chunk_index ASC',
      [fileId, fileType]
    );

    if (!chunks || chunks.length === 0) {
      return null;
    }

    const totalSize = chunks.reduce((sum, c) => sum + c.chunk_size, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunks) {
      let chunkData;
      const cd = chunk.chunk_data;
      if (cd instanceof Uint8Array) {
        chunkData = cd;
      } else if (cd instanceof ArrayBuffer) {
        chunkData = new Uint8Array(cd);
      } else if (typeof cd === 'string') {
        const encoder = new TextEncoder();
        chunkData = encoder.encode(cd);
      } else if (cd == null) {
        chunkData = new Uint8Array(0);
      } else {
        chunkData = new Uint8Array(cd);
      }
      result.set(chunkData, offset);
      offset += chunkData.length;
    }

    return result.buffer;
  } catch (error) {
    console.error('Error reading file from chunks:', error);
    return null;
  }
}

/**
 * 流式读取分块文件，通过 ReadableStream 按需按批从 D1 读取
 * 避免一次性拼接 200MB+ 大数组导致 Pages Functions CPU 超时 (Error 1102)
 * @param env Workers/Pages env（含 DB）
 * @param fileId 文件标识
 * @param fileType 文件类型
 * @param chunkBatchSize 每次从 D1 取多少个分块（默认 10，约 2.5MB @256KB 每块）
 * @returns {{ totalSize: number, totalChunks: number, stream: ReadableStream }}
 */
export async function streamFileFromChunks(env, fileId, fileType, chunkBatchSize = 10) {
  const countRow = await queryOne(env,
    'SELECT COUNT(*) as cnt, IFNULL(SUM(chunk_size),0) as total FROM file_chunks WHERE file_id = ? AND file_type = ?',
    [fileId, fileType]
  );
  const totalChunks = Number(countRow?.cnt || 0);
  const totalSize = Number(countRow?.total || 0);
  if (totalChunks === 0) return { totalSize: 0, totalChunks: 0, stream: null };

  const makeChunkReadable = (cd) => {
    if (cd instanceof Uint8Array) return cd;
    if (cd instanceof ArrayBuffer) return new Uint8Array(cd);
    if (typeof cd === 'string') return new TextEncoder().encode(cd);
    if (cd == null) return new Uint8Array(0);
    return new Uint8Array(cd);
  };

  // 状态放在 stream 外部，避免每次 pull 重建
  let cursor = 0;                 // 下一个要从 D1 读取的分块下标
  let pendingQueue = [];          // 已经从 D1 读出但尚未 enqueue 的分块队列
  let done = false;

  const stream = new ReadableStream({
    async pull(controller) {
      // 让出时间片，避免长时间占 CPU 触发 1102
      await new Promise(r => setTimeout(r, 0));

      // 队列为空且还有未读分块时，拉取下一批
      while (pendingQueue.length === 0 && !done && cursor < totalChunks) {
        const limit = Math.min(chunkBatchSize, totalChunks - cursor);
        const batch = await queryAll(env,
          'SELECT chunk_data FROM file_chunks WHERE file_id = ? AND file_type = ? ORDER BY chunk_index ASC LIMIT ? OFFSET ?',
          [fileId, fileType, limit, cursor]
        );
        if (!batch || batch.length === 0) {
          done = true;
          break;
        }
        pendingQueue = batch.map(row => makeChunkReadable(row.chunk_data));
        cursor += batch.length;
        if (cursor >= totalChunks) done = true;
      }

      if (pendingQueue.length > 0) {
        controller.enqueue(pendingQueue.shift());
      } else {
        controller.close();
      }
    },
  });

  return { totalSize, totalChunks, stream };
}
