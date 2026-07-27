import { jsonResponse, queryDB, queryOne } from '/functions/_utils';

export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const { id } = params;
  
  const userId = request.headers.get('X-User-Id');
  if (!userId) {
    return jsonResponse({ success: false, message: '未登录' }, 401);
  }

  const save = await queryOne(env, 'SELECT * FROM saves WHERE id = ?', [id]);
  if (!save) {
    return jsonResponse({ success: false, message: '存档不存在' }, 404);
  }

  if (save.user_id !== userId) {
    return jsonResponse({ success: false, message: '无权删除该存档' }, 403);
  }

  await queryDB(env, 'DELETE FROM file_chunks WHERE file_id = ?', [id]);
  await queryDB(env, 'DELETE FROM saves WHERE id = ?', [id]);

  return jsonResponse({
    success: true,
    message: '存档删除成功',
  });
}