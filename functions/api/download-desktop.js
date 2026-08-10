import { jsonResponse, queryOne, readFileFromChunks } from '../_utils';

const DESKTOP_FILE_ID = 'snowbox-desktop-v1';
const DESKTOP_FILE_NAME = 'SnowBox-Setup.exe';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const meta = await queryOne(env, "SELECT * FROM file_chunks WHERE file_id = ? AND file_type = 'desktop_app' LIMIT 1", [DESKTOP_FILE_ID]);
    if (!meta) {
      return jsonResponse({ success: false, message: '安装包未上传' }, 404);
    }

    const fileData = await readFileFromChunks(env, DESKTOP_FILE_ID, 'desktop_app');
    if (!fileData) {
      return jsonResponse({ success: false, message: '安装包文件不存在' }, 404);
    }

    return new Response(fileData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="' + DESKTOP_FILE_NAME + '"',
        'Content-Length': fileData.byteLength,
      },
    });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}
