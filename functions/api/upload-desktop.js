import { jsonResponse, parseJsonBody, queryDB, generateId, getCurrentTime } from '../_utils';

const FILE_ID = 'snowbox-desktop-v1';
const FILE_TYPE = 'desktop_app';

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await parseJsonBody(request);
    if (!body || !body.chunk_data) {
      return jsonResponse({ success: false, message: '缺少分块数据' }, 400);
    }

    const chunkIndex = body.chunk_index || 0;
    const chunkTotal = body.chunk_total || 1;
    const fileData = body.chunk_data;

    // base64 解码
    const binaryString = atob(fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const chunkId = generateId();
    const chunkSize = bytes.byteLength;
    const createdAt = getCurrentTime();

    // 存入 file_chunks 表
    await queryDB(env,
      'INSERT INTO file_chunks (id, file_id, file_type, chunk_index, chunk_data, chunk_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [chunkId, FILE_ID, FILE_TYPE, chunkIndex, bytes, chunkSize, createdAt]
    );

    return jsonResponse({
      success: true,
      message: `分块 ${chunkIndex + 1}/${chunkTotal} 上传成功`,
      data: { chunk_index: chunkIndex },
    });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}
