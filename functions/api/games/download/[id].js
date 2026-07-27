import { jsonResponse, queryOne, readFileFromChunks } from '../../../_utils';

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