import { jsonResponse, queryOne, readFileFromChunks } from '../../../_utils';

export async function onRequestGet(context) {
  const { env, params } = context;
  const { id } = params;

  const game = await queryOne(env, 'SELECT id FROM games WHERE id = ?', [id]);
  if (!game) {
    return jsonResponse({ success: false, message: '游戏不存在' }, 404);
  }

  const fileData = await readFileFromChunks(env, id, 'game_image');
  if (!fileData) {
    return new Response('', { status: 404 });
  }

  return new Response(fileData, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
