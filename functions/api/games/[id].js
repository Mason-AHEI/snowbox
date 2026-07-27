import { jsonResponse, queryDB, queryOne, readFileFromChunks } from '../../_utils';

export async function onRequestGet(context) {
  const { env, params } = context;
  const { id } = params;

  const game = await queryOne(env, 'SELECT * FROM games WHERE id = ?', [id]);
  if (!game) {
    return jsonResponse({ success: false, message: '游戏不存在' }, 404);
  }

  const fileData = await readFileFromChunks(env, id, 'game_file');
  if (!fileData) {
    return jsonResponse({ success: false, message: '游戏文件不存在' }, 404);
  }

  return new Response(fileData, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${game.file_name}"`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const { id } = params;

  const userId = request.url.searchParams.get('user_id');
  const userRole = request.url.searchParams.get('user_role');

  if (!userId || !userRole) {
    return jsonResponse({ success: false, message: '缺少用户信息' }, 400);
  }

  if (userRole !== 'superadmin') {
    return jsonResponse({ success: false, message: '权限不足，只有主管理员可以删除游戏' }, 403);
  }

  const game = await queryOne(env, 'SELECT * FROM games WHERE id = ?', [id]);
  if (!game) {
    return jsonResponse({ success: false, message: '游戏不存在' }, 404);
  }

  await queryDB(env, 'DELETE FROM file_chunks WHERE file_id = ?', [id]);
  await queryDB(env, 'DELETE FROM games WHERE id = ?', [id]);

  return jsonResponse({
    success: true,
    message: '游戏删除成功',
  });
}