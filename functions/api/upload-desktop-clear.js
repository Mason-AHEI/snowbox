import { jsonResponse, queryDB } from '../_utils';

const FILE_ID = 'snowbox-desktop-v1';
const FILE_TYPE = 'desktop_app';

export async function onRequestPost(context) {
  const { env } = context;

  try {
    // 删除旧的分块数据
    await queryDB(env, 'DELETE FROM file_chunks WHERE file_id = ? AND file_type = ?', [FILE_ID, FILE_TYPE]);

    return jsonResponse({
      success: true,
      message: '旧数据已清除',
    });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}
