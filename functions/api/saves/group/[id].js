import { jsonResponse, queryAll } from '../../../_utils';

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const { id } = params;
  
  const userId = request.headers.get('X-User-Id');
  if (!userId) {
    return jsonResponse({ success: false, message: '未登录' }, 401);
  }

  const saves = await queryAll(env, 'SELECT * FROM saves WHERE user_id = ? AND group_id = ? ORDER BY created_at DESC', [userId, id]);
  
  return jsonResponse({
    success: true,
    data: saves,
  });
}