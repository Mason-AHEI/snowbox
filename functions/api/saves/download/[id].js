import { jsonResponse, queryOne, readFileFromChunks } from '../../../_utils';

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const { id } = params;
  
  const userId = request.headers.get('X-User-Id');
  
  const save = await queryOne(env, 'SELECT * FROM saves WHERE id = ?', [id]);
  if (!save) {
    return jsonResponse({ success: false, message: '存档不存在' }, 404);
  }

  if (userId && save.user_id !== userId) {
    return jsonResponse({ success: false, message: '无权下载该存档' }, 403);
  }

  const fileData = await readFileFromChunks(env, id, 'save_file');
  if (!fileData) {
    return jsonResponse({ success: false, message: '存档文件不存在' }, 404);
  }

  return new Response(fileData, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="' + save.file_name + '"',
      'Content-Length': save.file_size,
    },
  });
}