import { jsonResponse, queryDB, queryOne } from '../../_utils';

export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const { id } = params;

  const userId = request.url.searchParams.get('user_id');

  if (!userId) {
    return jsonResponse({ success: false, message: '缺少用户 ID' }, 400);
  }

  const user = await queryOne(env, 'SELECT role FROM users WHERE id = ?', [userId]);
  if (!user || user.role !== 'superadmin') {
    return jsonResponse({ success: false, message: '权限不足，只有主管理员可以删除公告' }, 403);
  }

  const announcement = await queryOne(env, 'SELECT * FROM announcements WHERE id = ?', [id]);
  if (!announcement) {
    return jsonResponse({ success: false, message: '公告不存在' }, 404);
  }

  await queryDB(env, 'DELETE FROM announcements WHERE id = ?', [id]);

  return jsonResponse({
    success: true,
    message: '公告删除成功',
  });
}