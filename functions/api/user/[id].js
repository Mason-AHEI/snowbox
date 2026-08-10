import { jsonResponse, parseJsonBody, queryDB, queryOne, hashPassword } from '../../_utils';

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

  const requesterId = request.headers.get('X-User-Id');
  const requesterRole = request.headers.get('X-User-Role');
  const isSelfUpdate = requesterId === id;
  const isAdminUpdate = requesterRole === 'superadmin';

  if (body.role && !isAdminUpdate) {
    return jsonResponse({ success: false, message: '权限不足，只有主管理员可以修改角色' }, 403);
  }

  if (!isSelfUpdate && !isAdminUpdate) {
    return jsonResponse({ success: false, message: '权限不足' }, 403);
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
    const updatedUser = await queryOne(env, 'SELECT id, username, email, role, created_at FROM users WHERE id = ?', [id]);
    return jsonResponse({
      success: true,
      message: '资料已是最新',
      data: updatedUser,
    });
  }

  paramsList.push(id);
  const updateSql = 'UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?';
  await queryDB(env, updateSql, paramsList);

  const updatedUser = await queryOne(env, 'SELECT id, username, email, role, created_at FROM users WHERE id = ?', [id]);
  
  return jsonResponse({
    success: true,
    message: '资料更新成功',
    data: updatedUser,
  });
}