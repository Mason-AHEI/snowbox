import { jsonResponse, parseFormData, queryDB, generateId, getCurrentTime, writeFileInChunks } from '/functions/_utils';

export async function onRequestPost(context) {
  const { env, request } = context;
  
  const userId = request.headers.get('X-User-Id');
  
  if (!userId) {
    return jsonResponse({ success: false, message: '未登录' }, 401);
  }

  const formData = await parseFormData(request);
  const file = formData.get('file');
  const gameName = formData.get('game_name') || '未知游戏';
  const groupId = formData.get('group_id') || null;

  if (!file) {
    return jsonResponse({ success: false, message: '请选择文件' }, 400);
  }

  const fileName = file.name;
  const fileBytes = await file.arrayBuffer();
  const fileSize = fileBytes.byteLength;
  const saveId = generateId();
  const createdAt = getCurrentTime();

  await queryDB(env,
    'INSERT INTO saves (id, user_id, name, file_name, file_size, group_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [saveId, userId, gameName, fileName, fileSize, groupId, createdAt]
  );

  await writeFileInChunks(env, saveId, 'save_file', fileBytes);

  return jsonResponse({
    success: true,
    message: '存档上传成功',
    data: {
      id: saveId,
      name: gameName,
      file_name: fileName,
      file_size: fileSize,
      group_id: groupId,
      created_at: createdAt,
    },
  });
}