import { jsonResponse, parseJsonBody, queryDB, queryOne } from '/functions/_utils';

export async function onRequestPut(context) {
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
    return jsonResponse({ success: false, message: '无权修改该存档' }, 403);
  }

  const body = await parseJsonBody(request);
  const groupId = body.group_id;

  await queryDB(env, 'UPDATE saves SET group_id = ? WHERE id = ?', [groupId || null, id]);

  return jsonResponse({
    success: true,
    message: '分组更新成功',
  });
}