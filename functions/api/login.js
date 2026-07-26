import { jsonResponse, parseJsonBody, queryOne, hashPassword } from '/functions/_utils';

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await parseJsonBody(request);
  
  if (!body || !body.email || !body.password) {
    return jsonResponse({ success: false, message: '邮箱和密码必填' }, 400);
  }

  const user = await queryOne(env, 'SELECT * FROM users WHERE email = ?', [body.email.toLowerCase()]);
  if (!user) {
    return jsonResponse({ success: false, message: '邮箱或密码错误' }, 401);
  }

  const hashedPassword = await hashPassword(body.password);
  if (user.password !== hashedPassword) {
    return jsonResponse({ success: false, message: '邮箱或密码错误' }, 401);
  }

  return jsonResponse({
    success: true,
    message: '登录成功',
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    },
  });
}