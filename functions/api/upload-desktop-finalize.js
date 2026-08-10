import { jsonResponse, queryAll } from '../_utils';

const FILE_ID = 'snowbox-desktop-v1';
const FILE_TYPE = 'desktop_app';

export async function onRequestPost(context) {
  const { env } = context;

  try {
    // 检查所有分块是否都已上传
    const chunks = await queryAll(env,
      'SELECT COUNT(*) as count FROM file_chunks WHERE file_id = ? AND file_type = ?',
      [FILE_ID, FILE_TYPE]
    );
    
    const count = chunks[0]?.count || 0;

    return jsonResponse({
      success: true,
      message: '安装包上传完成',
      data: { chunk_count: count },
    });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}
