import { jsonResponse, queryOne, readFileFromChunks } from '../../../_utils';

export async function onRequestGet(context) {
  const { env, params } = context;
  const { id } = params;

  const game = await queryOne(env, 'SELECT * FROM games WHERE id = ?', [id]);
  if (!game || !game.has_image) {
    return jsonResponse({ success: false, message: '游戏图片不存在' }, 404);
  }

  const fileData = await readFileFromChunks(env, id, 'game_image');
  if (!fileData) {
    return jsonResponse({ success: false, message: '图片文件不存在' }, 404);
  }

  return new Response(fileData, {
    headers: {
      'Content-Type': 'image/png',
      'Access-Control-Allow-Origin': '*',
    },
  });
}