import { jsonResponse, queryAll, parseFormData, queryDB, queryOne, generateId, getCurrentTime, writeFileInChunks } from '/functions/_utils';

export async function onRequestGet(context) {
  const { env, request } = context;
  const searchQuery = request.url.searchParams.get('search');

  let sql = 'SELECT id, name, url, file_name, file_size, description, author_id, author_name, has_image, has_video, created_at FROM games ORDER BY created_at DESC';
  let params = [];

  if (searchQuery) {
    sql = 'SELECT id, name, url, file_name, file_size, description, author_id, author_name, has_image, has_video, created_at FROM games WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC';
    params = [`%${searchQuery}%`, `%${searchQuery}%`];
  }

  const games = await queryAll(env, sql, params);
  
  return jsonResponse({
    success: true,
    data: games,
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  const formData = await parseFormData(request);
  if (!formData) {
    return jsonResponse({ success: false, message: '请求格式错误' }, 400);
  }

  const userId = request.headers.get('X-User-Id') || formData.get('user_id');
  if (!userId) {
    return jsonResponse({ success: false, message: '缺少用户 ID' }, 400);
  }

  const user = await queryOne(env, 'SELECT role, username FROM users WHERE id = ?', [userId]);
  if (!user || user.role !== 'superadmin') {
    return jsonResponse({ success: false, message: '权限不足，只有主管理员可以上传游戏' }, 403);
  }

  const name = formData.get('name');
  const url = formData.get('url');
  const description = formData.get('description');
  const gameFile = formData.get('game_file');
  const coverImage = formData.get('cover_image');
  const promoVideo = formData.get('promo_video');

  if (!name) {
    return jsonResponse({ success: false, message: '游戏名称必填' }, 400);
  }

  const gameId = generateId();
  const createdAt = getCurrentTime();

  const fileName = gameFile ? gameFile.name : null;
  const fileSize = gameFile ? (await gameFile.arrayBuffer()).byteLength : 0;
  const hasImage = coverImage ? 1 : 0;
  const hasVideo = promoVideo ? 1 : 0;

  await queryDB(env,
    'INSERT INTO games (id, name, url, file_name, file_size, description, author_id, author_name, has_image, has_video, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [gameId, name, url || '', fileName, fileSize, description || '', userId, user.username, hasImage, hasVideo, createdAt]
  );

  if (gameFile) {
    const fileBytes = await gameFile.arrayBuffer();
    await writeFileInChunks(env, gameId, 'game_file', fileBytes);
  }

  if (coverImage) {
    const imageBytes = await coverImage.arrayBuffer();
    await writeFileInChunks(env, gameId, 'game_image', imageBytes);
  }

  if (promoVideo) {
    const videoBytes = await promoVideo.arrayBuffer();
    await writeFileInChunks(env, gameId, 'game_video', videoBytes);
  }

  return jsonResponse({
    success: true,
    message: '游戏上传成功',
    data: {
      id: gameId,
      name: name,
      url: url || '',
      file_name: fileName,
      file_size: fileSize,
      description: description || '',
      author_id: userId,
      author_name: user.username,
      has_image: hasImage,
      has_video: hasVideo,
      created_at: createdAt,
    },
  });
}