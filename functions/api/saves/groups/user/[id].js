import { jsonResponse, queryAll } from '/functions/_utils';

export async function onRequestGet(context) {
  const { env, params } = context;
  const { id } = params;
  
  const userId = context.request.headers.get('X-User-Id');
  if (!userId) {
    return jsonResponse({ success: false, message: '未登录' }, 401);
  }

  if (userId !== id) {
    return jsonResponse({ success: false, message: '无权访问他人分组' }, 403);
  }

  const groups = await queryAll(env, 'SELECT * FROM save_groups WHERE user_id = ? ORDER BY created_at DESC', [id]);
  
  return jsonResponse({
    success: true,
    data: groups,
  });
}