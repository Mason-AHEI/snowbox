import { jsonResponse, parseFormData, queryDB, generateId, getCurrentTime, writeFileInChunks } from '../../_utils';

export async function onRequestPost(context) {
  const { env, request } = context;
  const userId = request.headers.get('X-User-Id');
  
  if (!userId) {
    return jsonResponse({ success: false, message: '未登录' }, 401);
  }

  const formData = await parseFormData(request);
  const files = formData.getAll('files');
  const groupId = formData.get('group_id') || null;

  if (!files || files.length === 0) {
    return jsonResponse({ success: false, message: '请选择文件' }, 400);
  }

  const results = [];
  for (const file of files) {
    const fileName = file.name;
    const fileBytes = await file.arrayBuffer();
    const fileSize = fileBytes.byteLength;
    const saveId = generateId();
    const createdAt = getCurrentTime();

    await queryDB(env,
      'INSERT INTO saves (id, user_id, name, file_name, file_size, group_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [saveId, userId, fileName, fileName, fileSize, groupId, createdAt]
    );

    await writeFileInChunks(env, saveId, 'save_file', fileBytes);

    results.push({
      id: saveId,
      file_name: fileName,
      file_size: fileSize,
    });
  }

  return jsonResponse({
    success: true,
    message: `成功上传 ${results.length} 个文件`,
    data: results,
  });
}