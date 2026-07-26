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
    return await env.DB.prepare(sql).bind(...params).run();
  } catch (error) {
    console.error('DB Error:', error);
    throw error;
  }
}

export async function queryAll(env, sql, params = []) {
  try {
    const result = await env.DB.prepare(sql).bind(...params).all();
    return result.results || [];
  } catch (error) {
    console.error('DB Error:', error);
    throw error;
  }
}

export async function queryOne(env, sql, params = []) {
  try {
    const result = await env.DB.prepare(sql).bind(...params).first();
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

export const CHUNK_SIZE = 512 * 1024;

export async function writeFileInChunks(env, fileId, fileType, fileData) {
  const totalSize = fileData.byteLength;
  const totalChunks = Math.max(1, Math.floor((totalSize + CHUNK_SIZE - 1) / CHUNK_SIZE));
  const created_at = getCurrentTime();

  const statements = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = min(start + CHUNK_SIZE, totalSize);
    const chunk = fileData.slice(start, end);
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
    const chunkData = chunk.chunk_data instanceof Uint8Array ? chunk.chunk_data : new Uint8Array(chunk.chunk_data);
    result.set(chunkData, offset);
    offset += chunk.chunk_size;
  }

  return result.buffer;
}

function max(a, b) {
  return a > b ? a : b;
}

function min(a, b) {
  return a < b ? a : b;
}