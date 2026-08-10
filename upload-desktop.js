// 桌面版安装包分块上传脚本（直接调用线上 Pages Functions API）
// 使用方法: node upload-desktop.js
// 功能: 断点续传, 256KB 分块, 重试机制, 进度显示

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://snowbox.pages.dev/api';
const EXE_PATH = 'F:\\GitHub\\Snow Box Desktop\\snow-box-python\\dist\\install_snowbox.exe';
const CHUNK_SIZE = 256 * 1024; // 256KB
const PROGRESS_FILE = path.join(__dirname, '.desktop-upload-progress.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log('[进度] 发现断点续传记录, 已上传分块数:', data.uploaded);
      return data.uploaded || 0;
    }
  } catch (e) {}
  return 0;
}

function saveProgress(uploaded) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ uploaded }));
  } catch (e) {}
}

async function clearOldChunks() {
  console.log('[准备] 清除线上旧的桌面版分块数据...');
  const res = await fetch(API_BASE + '/upload-desktop-clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json.success) {
      console.log('[准备] 旧数据已清除');
      return true;
    } else {
      console.error('[准备] 清除失败:', json.message);
      return false;
    }
  } catch (e) {
    console.error('[准备] 清除响应非JSON:', text.substring(0, 200));
    return false;
  }
}

async function uploadChunk(chunkIndex, chunkTotal, base64Data, retryCount = 0) {
  const maxRetries = 5;
  const waitTime = 2000 * (retryCount + 1);

  try {
    const res = await fetch(API_BASE + '/upload-desktop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chunk_index: chunkIndex,
        chunk_total: chunkTotal,
        chunk_data: base64Data,
      }),
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (!json.success) {
        throw new Error(json.message || '未知错误');
      }
      return { ok: true };
    } catch (parseErr) {
      // 非 JSON 响应可能是 503 / 限流 HTML
      if (retryCount < maxRetries) {
        console.log(`      ↻ 限流或响应异常, 等待 ${waitTime/1000}s 后重试 (${retryCount+1}/${maxRetries})...`);
        await sleep(waitTime);
        return uploadChunk(chunkIndex, chunkTotal, base64Data, retryCount + 1);
      }
      console.error('      ✗ 响应:', text.substring(0, 200));
      return { ok: false, error: '无效响应' };
    }
  } catch (err) {
    if (retryCount < maxRetries) {
      console.log(`      ↻ 网络错误: ${err.message}, 等待 ${waitTime/1000}s 后重试 (${retryCount+1}/${maxRetries})...`);
      await sleep(waitTime);
      return uploadChunk(chunkIndex, chunkTotal, base64Data, retryCount + 1);
    }
    return { ok: false, error: err.message };
  }
}

async function finalize(chunkTotal) {
  const res = await fetch(API_BASE + '/upload-desktop-finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chunk_total: chunkTotal }),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json.success) {
      console.log('\n✅ 上传完成! 线上分块数:', json.data?.chunk_count);
      return true;
    } else {
      console.error('\n❌ Finalize 失败:', json.message);
      return false;
    }
  } catch (e) {
    console.error('\n❌ Finalize 响应异常:', text.substring(0, 200));
    return false;
  }
}

async function main() {
  if (!fs.existsSync(EXE_PATH)) {
    console.error('❌ 找不到安装包文件:', EXE_PATH);
    process.exit(1);
  }

  const stat = fs.statSync(EXE_PATH);
  const totalBytes = stat.size;
  const chunkTotal = Math.ceil(totalBytes / CHUNK_SIZE);
  const mb = (totalBytes / 1024 / 1024).toFixed(2);

  console.log('========================================');
  console.log('  Snow Box 桌面版安装包上传');
  console.log('========================================');
  console.log('  文件:  ', EXE_PATH);
  console.log('  大小:  ', mb, 'MB');
  console.log('  分块:  ', chunkTotal, '块 (每块', CHUNK_SIZE/1024, 'KB)');
  console.log('  接口:  ', API_BASE);
  console.log('========================================\n');

  // 断点续传: 先尝试恢复进度，如果用户指定了全新开始（参数 --fresh）则清除
  let startFrom = 0;
  const freshStart = process.argv.includes('--fresh');
  if (freshStart) {
    await clearOldChunks();
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  } else {
    startFrom = loadProgress();
    if (startFrom > 0) {
      console.log(`[断点续传] 从第 ${startFrom + 1} 块开始上传\n`);
    } else {
      // 如果是全新上传, 先清除旧数据防止重复
      await clearOldChunks();
    }
  }

  const fd = fs.openSync(EXE_PATH, 'r');
  const buffer = Buffer.alloc(CHUNK_SIZE);
  let startTime = Date.now();
  let uploadedBytes = startFrom * CHUNK_SIZE;

  for (let i = startFrom; i < chunkTotal; i++) {
    const bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, i * CHUNK_SIZE);
    const chunkBuf = buffer.slice(0, bytesRead);
    const base64 = chunkBuf.toString('base64');

    const pct = ((i + 1) / chunkTotal * 100).toFixed(1);
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = uploadedBytes / 1024 / elapsed;
    const remaining = chunkTotal - (i + 1);
    const etaSec = elapsed > 0 ? Math.round(remaining * elapsed / (i + 1 - startFrom)) : 0;

    process.stdout.write(
      `  上传中 [${i + 1}/${chunkTotal}] ${pct}%  ` +
      `速度 ${speed.toFixed(1)} KB/s  ETA ${etaSec}s  ` +
      `块大小 ${(bytesRead/1024).toFixed(1)} KB\r`
    );

    const result = await uploadChunk(i, chunkTotal, base64);
    if (!result.ok) {
      console.error(`\n\n❌ 分块 ${i + 1} 上传失败: ${result.error}`);
      fs.closeSync(fd);
      saveProgress(i);
      console.log('已保存进度, 下次运行将从此位置继续');
      process.exit(1);
    }

    uploadedBytes += bytesRead;
    saveProgress(i + 1);

    // 每 100 块暂停一下, 防限流
    if ((i + 1) % 100 === 0 && i + 1 < chunkTotal) {
      process.stdout.write('\n  防限流暂停 500ms...\n');
      await sleep(500);
    }
  }

  fs.closeSync(fd);
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✅ 所有分块上传完成! 总耗时: ${totalElapsed}s`);

  const ok = await finalize(chunkTotal);
  if (ok) {
    // 清理进度文件
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
    console.log('\n🎉 桌面版安装包已成功上传, 用户可以在用户中心下载了');
  } else {
    process.exit(1);
  }
}

main().catch(e => {
  console.error('\n❌ 未预期的错误:', e);
  process.exit(1);
});
