import { jsonResponse, queryOne, queryDB, writeFileInChunks } from '../../../_utils';

export async function onRequestPost(context) {
  const { env, params, request } = context;
  const { id } = params;

  const url = new URL(request.url);
  const userId = request.headers.get('X-User-Id') || url.searchParams.get('user_id');
  const userRole = request.headers.get('X-User-Role') || url.searchParams.get('user_role');

  if (!userId) {
    return jsonResponse({ success: false, message: '需要登录才能上传' }, 401);
  }

  try {
    const game = await queryOne(env, 'SELECT id, author_id FROM games WHERE id = ?', [id]);
    if (!game) {
      return jsonResponse({ success: false, message: '游戏不存在' }, 404);
    }

    if (game.author_id !== userId && userRole !== 'superadmin') {
      return jsonResponse({ success: false, message: '权限不足' }, 403);
    }

    const body = await request.json();
    const { file_data, file_name, file_type = 'game' } = body;

    if (!file_data) {
      return jsonResponse({ success: false, message: '缺少文件数据' }, 400);
    }

    const binaryString = atob(file_data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    await queryDB(env, 'DELETE FROM file_chunks WHERE file_id = ? AND file_type = ?', [id, file_type]);

    await writeFileInChunks(env, id, file_type, bytes);

    const fileSize = bytes.byteLength;

    if (file_type === 'game') {
      await queryDB(env, 'UPDATE games SET file_name = ?, file_size = ? WHERE id = ?', [file_name || '', fileSize, id]);
    }

    if (file_type === 'game_image') {
      await queryDB(env, 'UPDATE games SET has_image = 1 WHERE id = ?', [id]);
    }

    if (file_type === 'game_video') {
      await queryDB(env, 'UPDATE games SET has_video = 1 WHERE id = ?', [id]);
    }

    return jsonResponse({
      success: true,
      message: '上传成功',
      data: { id, file_name, file_size: fileSize, file_type },
    });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}
