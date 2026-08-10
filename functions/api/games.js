import { jsonResponse, queryAll, queryDB, queryOne, generateId, getCurrentTime, writeFileInChunks, parseFormData } from '../_utils';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const searchQuery = url.searchParams.get('search');
  const { env } = context;

  try {
    let sql = 'SELECT id, name, url, file_name, file_size, description, author_id, author_name, has_image, has_video, created_at FROM games ORDER BY created_at DESC';
    let params = [];

    if (searchQuery) {
      sql = 'SELECT id, name, url, file_name, file_size, description, author_id, author_name, has_image, has_video, created_at FROM games WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC';
      params = ['%' + searchQuery + '%', '%' + searchQuery + '%'];
    }

    const games = await queryAll(env, sql, params);
    return jsonResponse({ success: true, data: games });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const formData = await parseFormData(request);
    if (!formData) {
      return jsonResponse({ success: false, message: '无法解析表单数据' }, 400);
    }

    const name = formData.get('name');
    const url = formData.get('url');
    const description = formData.get('description');
    const file = formData.get('game_file') || formData.get('file');
    const coverImage = formData.get('cover_image');
    const promoVideo = formData.get('promo_video');
    const authorId = formData.get('author_id') || request.headers.get('X-User-Id');
    const authorName = formData.get('author_name') || request.headers.get('X-User-Name');

    if (!name || (!url && !file)) {
      return jsonResponse({ success: false, message: '游戏名称和URL或文件必填' }, 400);
    }

    if (!authorId) {
      return jsonResponse({ success: false, message: '需要登录才能上传' }, 401);
    }

    const gameId = generateId();
    let fileName = '';
    let fileSize = 0;

    if (file && file.size > 0) {
      fileName = file.name;
      const fileBytes = await file.arrayBuffer();
      fileSize = fileBytes.byteLength;
      await writeFileInChunks(env, gameId, 'game', fileBytes);
    }

    const hasImage = coverImage && coverImage.size > 0;
    const hasVideo = promoVideo && promoVideo.size > 0;

    if (hasImage) {
      const imageBytes = await coverImage.arrayBuffer();
      await writeFileInChunks(env, gameId, 'game_image', imageBytes);
    }

    if (hasVideo) {
      const videoBytes = await promoVideo.arrayBuffer();
      await writeFileInChunks(env, gameId, 'game_video', videoBytes);
    }

    const createdAt = getCurrentTime();
    const finalUrl = url || `/api/games/download/${gameId}`;
    const displayName = fileName || name;

    const sql = 'INSERT INTO games (id, name, url, file_name, file_size, description, author_id, author_name, has_image, has_video, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    await queryDB(env, sql, [gameId, name, finalUrl, displayName, fileSize, description || '', authorId, authorName || 'Unknown', hasImage ? 1 : 0, hasVideo ? 1 : 0, createdAt]);

    return jsonResponse({
      success: true,
      message: '游戏上传成功',
      data: { id: gameId, name, url: finalUrl, file_name: displayName, file_size: fileSize, description: description || '', author_id: authorId, author_name: authorName || 'Unknown', has_image: hasImage, has_video: hasVideo, created_at: createdAt },
    });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  if (!id) {
    return jsonResponse({ success: false, message: '游戏ID必填' }, 400);
  }

  const userId = request.headers.get('X-User-Id') || url.searchParams.get('user_id');
  const userRole = request.headers.get('X-User-Role') || url.searchParams.get('user_role');

  if (!userId) {
    return jsonResponse({ success: false, message: '需要登录才能删除' }, 401);
  }

  try {
    const game = await queryOne(env, 'SELECT author_id FROM games WHERE id = ?', [id]);
    if (!game) {
      return jsonResponse({ success: false, message: '游戏不存在' }, 404);
    }

    if (game.author_id !== userId && userRole !== 'superadmin') {
      return jsonResponse({ success: false, message: '权限不足，无法删除' }, 403);
    }

    await queryDB(env, 'DELETE FROM games WHERE id = ?', [id]);
    await queryDB(env, 'DELETE FROM file_chunks WHERE file_id = ?', [id]);

    return jsonResponse({ success: true, message: '删除成功' });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}
