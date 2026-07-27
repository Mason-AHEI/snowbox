import { jsonResponse, parseJsonBody, queryDB, generateId, getCurrentTime } from '/functions/_utils';

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
  await queryDB(env,
    'INSERT INTO save_groups (id, user_id, name, created_at) VALUES (?, ?, ?, ?)',
    [groupId, userId, body.name, getCurrentTime()]
  );

  return jsonResponse({
    success: true,
    message: '分组创建成功',
    data: {
      id: groupId,
      name: body.name,
    },
  });
}