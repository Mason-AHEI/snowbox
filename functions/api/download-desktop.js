import { jsonResponse, queryOne, streamFileFromChunks } from '../_utils';

const DESKTOP_FILE_ID = 'snowbox-desktop-v1';
const DESKTOP_FILE_NAME = 'SnowBox-Setup.exe';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const meta = await queryOne(env, "SELECT COUNT(*) as cnt FROM file_chunks WHERE file_id = ? AND file_type = 'desktop_app'", [DESKTOP_FILE_ID]);
    if (!meta || Number(meta.cnt || 0) === 0) {
      return jsonResponse({ success: false, message: '安装包未上传' }, 404);
    }

    const { totalSize, totalChunks, stream } = await streamFileFromChunks(env, DESKTOP_FILE_ID, 'desktop_app', 8);
    if (!stream) {
      return jsonResponse({ success: false, message: '安装包文件不存在' }, 404);
    }

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="' + DESKTOP_FILE_NAME + '"',
        'Content-Length': String(totalSize),
        'X-Total-Chunks': String(totalChunks),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('download-desktop error:', error);
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}
