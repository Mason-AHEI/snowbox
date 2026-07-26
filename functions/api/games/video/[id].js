import { jsonResponse, queryOne, readFileFromChunks } from '/functions/_utils';

export async function onRequestGet(context) {
  const { env, params } = context;
  const { id } = params;

  const game = await queryOne(env, 'SELECT * FROM games WHERE id = ?', [id]);
  if (!game || !game.has_video) {
    return jsonResponse({ success: false, message: '游戏视频不存在' }, 404);
  }

  const fileData = await readFileFromChunks(env, id, 'game_video');
  if (!fileData) {
    return jsonResponse({ success: false, message: '视频文件不存在' }, 404);
  }

  return new Response(fileData, {
    headers: {
      'Content-Type': 'video/mp4',
      'Access-Control-Allow-Origin': '*',
    },
  });
}