import { jsonResponse, getCurrentTime } from '/functions/_utils';

export async function onRequestGet(context) {
  const { env } = context;
  const dbAvailable = env && env.DB ? true : false;
  return jsonResponse({
    success: true,
    message: 'Snow Box API 运行正常',
    timestamp: getCurrentTime(),
    db_available: dbAvailable,
  });
}