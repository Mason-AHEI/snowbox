import { jsonResponse, parseJsonBody, queryDB, generateId, getCurrentTime } from '../../_utils';

export async function onRequestPost(context) {
  const { env, request } = context;
  
  const body = await parseJsonBody(request);
  if (!body || !body.name) {
    return jsonResponse({ success: false, message: '分组名称必填' }, 400);
  }

  const userId = request.headers.get('X-User-Id') || body.user_id;
  if (!userId) {
    return jsonResponse({ success: false, message: '缺少用户 ID' }, 400);
  }

  const groupId = generateId();
  const color = body.color || '#6B7280';
  await queryDB(env,
    'INSERT INTO save_groups (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
    [groupId, userId, body.name, color, getCurrentTime()]
  );

  return jsonResponse({
    success: true,
    message: '分组创建成功',
    data: {
      id: groupId,
      name: body.name,
      color: color,
    },
  });
}