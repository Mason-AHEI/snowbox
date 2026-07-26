import { jsonResponse, parseJsonBody, queryDB, queryOne, hashPassword } from '/functions/_utils';

export async function onRequestGet(context) {
  const { env, params } = context;
  const { id } = params;

  const user = await queryOne(env, 'SELECT id, username, email, role, created_at FROM users WHERE id = ?', [id]);
  if (!user) {
    return jsonResponse({ success: false, message: '用户不存在' }, 404);
  }

  return jsonResponse({
    success: true,
    data: user,
  });
}

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const { id } = params;
  const body = await parseJsonBody(request);

  const user = await queryOne(env, 'SELECT * FROM users WHERE id = ?', [id]);
  if (!user) {
    return jsonResponse({ success: false, message: '用户不存在' }, 404);
  }

  let updates = [];
  let paramsList = [];

  if (body.username && body.username !== user.username) {
    const existing = await queryOne(env, 'SELECT id FROM users WHERE username = ? AND id != ?', [body.username, id]);
    if (existing) {
      return jsonResponse({ success: false, message: '该用户名已被使用' }, 409);
    }
    updates.push('username = ?');
    paramsList.push(body.username);
  }

  if (body.email && body.email !== user.email) {
    const existing = await queryOne(env, 'SELECT id FROM users WHERE email = ? AND id != ?', [body.email.toLowerCase(), id]);
    if (existing) {
      return jsonResponse({ success: false, message: '该邮箱已被注册' }, 409);
    }
    updates.push('email = ?');
    paramsList.push(body.email.toLowerCase());
  }

  if (body.role && body.role !== user.role) {
    updates.push('role = ?');
    paramsList.push(body.role);
  }

  if (updates.length === 0) {
    return jsonResponse({ success: false, message: '没有需要更新的内容' }, 400);
  }

  paramsList.push(id);
  await queryDB(env, `UPDATE users SET ${updates.join(', ')} WHERE id = ?`, paramsList);

  const updatedUser = await queryOne(env, 'SELECT id, username, email, role, created_at FROM users WHERE id = ?', [id]);
  
  return jsonResponse({
    success: true,
    message: '资料更新成功',
    data: updatedUser,
  });
}