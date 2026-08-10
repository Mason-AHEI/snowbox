import { jsonResponse, queryAll } from '../_utils';

export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const result = await queryAll(env, 'SELECT 1 as test');
    return jsonResponse({ success: true, data: result });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}
