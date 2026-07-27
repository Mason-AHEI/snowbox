import { jsonResponse, queryAll } from '../_utils';

export async function onRequestGet(context) {
  const { env } = context;
  const users = await queryAll(env, 'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC');
  
  return jsonResponse({
    success: true,
    data: users,
  });
}