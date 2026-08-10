import { jsonResponse, queryOne, queryDB } from '../../_utils';

export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const { id } = params;

  const url = new URL(request.url);
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
