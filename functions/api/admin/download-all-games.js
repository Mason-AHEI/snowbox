import { queryAll, queryOne, getCurrentTime } from '../../_utils';

export async function onRequestGet(context) {
  const { env, request } = context;
  const userId = request.headers.get('X-User-Id');

  if (!userId) {
    return new Response(JSON.stringify({ success: false, message: '缺少用户 ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const user = await queryOne(env, 'SELECT role FROM users WHERE id = ?', [userId]);
  if (!user || user.role !== 'superadmin') {
    return new Response(JSON.stringify({ success: false, message: '权限不足，只有主管理员可以下载所有游戏' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const games = await queryAll(env, 'SELECT * FROM games ORDER BY created_at DESC');

  const allGamesData = [];
  for (const game of games) {
    allGamesData.push({
      id: game.id,
      name: game.name,
      url: game.url,
      file_name: game.file_name,
      file_size: game.file_size,
      description: game.description,
      author_id: game.author_id,
      author_name: game.author_name,
      has_image: game.has_image,
      has_video: game.has_video,
      created_at: game.created_at,
    });
  }

  const content = JSON.stringify({
    success: true,
    exported_at: getCurrentTime(),
    total_games: allGamesData.length,
    games: allGamesData,
  }, null, 2);

  return new Response(content, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="snow-box-games-${Date.now()}.json"`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}