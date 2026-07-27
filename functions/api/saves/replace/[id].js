import { jsonResponse, parseFormData, queryDB, queryOne, writeFileInChunks, getCurrentTime } from '/functions/_utils';

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const { id } = params;
  
  const userId = request.headers.get('X-User-Id');
  if (!userId) {
    return jsonResponse({ success: false, message: '未登录' }, 401);
  }

  const save = await queryOne(env, 'SELECT * FROM saves WHERE id = ?', [id]);
  if (!save) {
    return jsonResponse({ success: false, message: '存档不存在' }, 404);
  }

  if (save.user_id !== userId) {
    return jsonResponse({ success: false, message: '无权替换该存档' }, 403);
  }

  const formData = await parseFormData(request);
  const file = formData.get('file');

  if (!file) {
    return jsonResponse({ success: false, message: '请选择文件' }, 400);
  }

  const fileBytes = await file.arrayBuffer();
  const fileSize = fileBytes.byteLength;

  await queryDB(env, 'DELETE FROM file_chunks WHERE file_id = ?', [id]);
  await writeFileInChunks(env, id, 'save_file', fileBytes);

  await queryDB(env,
    'UPDATE saves SET file_name = ?, file_size = ?, created_at = ? WHERE id = ?',
    [file.name, fileSize, getCurrentTime(), id]
  );

  return jsonResponse({
    success: true,
    message: '存档替换成功',
    data: {
      file_name: file.name,
      file_size: fileSize,
    },
  });
}