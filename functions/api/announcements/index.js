import { jsonResponse, parseJsonBody, queryDB, queryAll, queryOne, generateId, getCurrentTime } from '/functions/_utils';

export async function onRequestGet(context) {
  const { env } = context;
  const announcements = await queryAll(env, 'SELECT * FROM announcements ORDER BY created_at DESC');
  
  return jsonResponse({
    success: true,
    data: announcements,
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  const body = await parseJsonBody(request);
  if (!body || !body.title || !body.content) {
    return jsonResponse({ success: false, message: '标题和内容必填' }, 400);
  }

  const userId = request.headers.get('X-User-Id') || body.author_id;
  if (!userId) {
    return jsonResponse({ success: false, message: '缺少用户 ID' }, 400);
  }

  const user = await queryOne(env, 'SELECT role, username FROM users WHERE id = ?', [userId]);
  if (!user || user.role !== 'superadmin') {
    return jsonResponse({ success: false, message: '权限不足，只有主管理员可以发布公告' }, 403);
  }

  const announcementId = generateId();
  const createdAt = getCurrentTime();

  await queryDB(env,
    'INSERT INTO announcements (id, title, content, author_id, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [announcementId, body.title, body.content, userId, user.username, createdAt]
  );

  return jsonResponse({
    success: true,
    message: '公告发布成功',
    data: {
      id: announcementId,
      title: body.title,
      content: body.content,
      author_id: userId,
      author_name: user.username,
      created_at: createdAt,
    },
  });
}