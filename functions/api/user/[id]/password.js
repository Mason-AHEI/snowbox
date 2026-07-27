import { jsonResponse, parseJsonBody, queryDB, queryOne, hashPassword } from '../../../_utils';

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const { id } = params;
  const body = await parseJsonBody(request);

  if (!body || !body.password) {
    return jsonResponse({ success: false, message: '密码必填' }, 400);
  }

  const user = await queryOne(env, 'SELECT * FROM users WHERE id = ?', [id]);
  if (!user) {
    return jsonResponse({ success: false, message: '用户不存在' }, 404);
  }

  const hashedPassword = await hashPassword(body.password);
  await queryDB(env, 'UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);

  return jsonResponse({
    success: true,
    message: '密码修改成功',
  });
}