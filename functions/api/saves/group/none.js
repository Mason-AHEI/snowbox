import { jsonResponse, queryAll } from '/functions/_utils';

export async function onRequestGet(context) {
  const { env, request } = context;
  const userId = request.url.searchParams.get('user_id');
  
  if (!userId) {
    return jsonResponse({ success: false, message: '缺少用户 ID' }, 400);
  }

  const saves = await queryAll(env, 'SELECT * FROM saves WHERE user_id = ? AND group_id IS NULL ORDER BY created_at DESC', [userId]);
  
  return jsonResponse({
    success: true,
    data: saves,
  });
}