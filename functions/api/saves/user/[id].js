import { jsonResponse, queryAll } from '../../../_utils';

export async function onRequestGet(context) {
  const { env, params } = context;
  const { id } = params;
  
  const userId = context.request.headers.get('X-User-Id');
  if (!userId) {
    return jsonResponse({ success: false, message: '未登录' }, 401);
  }

  if (userId !== id) {
    return jsonResponse({ success: false, message: '无权访问他人存档' }, 403);
  }

  const saves = await queryAll(env, 'SELECT * FROM saves WHERE user_id = ? ORDER BY created_at DESC', [id]);
  
  return jsonResponse({
    success: true,
    data: saves,
  });
}