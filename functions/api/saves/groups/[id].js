import { jsonResponse, parseJsonBody, queryDB, queryOne } from '../../../_utils';

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const { id } = params;
  
  const body = await parseJsonBody(request);
  if (!body || !body.name) {
    return jsonResponse({ success: false, message: '分组名称必填' }, 400);
  }

  const userId = request.headers.get('X-User-Id');
  if (!userId) {
    return jsonResponse({ success: false, message: '未登录' }, 401);
  }

  const group = await queryOne(env, 'SELECT * FROM save_groups WHERE id = ?', [id]);
  if (!group) {
    return jsonResponse({ success: false, message: '分组不存在' }, 404);
  }

  if (group.user_id !== userId) {
    return jsonResponse({ success: false, message: '无权修改该分组' }, 403);
  }

  await queryDB(env, 'UPDATE save_groups SET name = ? WHERE id = ?', [body.name, id]);

  return jsonResponse({
    success: true,
    message: '分组名称更新成功',
  });
}

export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const { id } = params;
  
  const userId = request.headers.get('X-User-Id');
  if (!userId) {
    return jsonResponse({ success: false, message: '未登录' }, 401);
  }

  const group = await queryOne(env, 'SELECT * FROM save_groups WHERE id = ?', [id]);
  if (!group) {
    return jsonResponse({ success: false, message: '分组不存在' }, 404);
  }

  if (group.user_id !== userId) {
    return jsonResponse({ success: false, message: '无权删除该分组' }, 403);
  }

  await queryDB(env, 'UPDATE saves SET group_id = NULL WHERE group_id = ?', [id]);
  await queryDB(env, 'DELETE FROM save_groups WHERE id = ?', [id]);

  return jsonResponse({
    success: true,
    message: '分组删除成功',
  });
}