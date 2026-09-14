'use strict';

// MV3 service worker：负责从远端后端拉取媒体清单，
// 供 popup 通过 chrome.runtime.sendMessage 调用。

const DEFAULT_BACKEND = 'http://127.0.0.1:5000';

// 后端地址可经 chrome.storage.sync 覆盖（键：backendUrl）
function getBackendUrl() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve(DEFAULT_BACKEND);
      return;
    }
    chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND }, (items) => {
      resolve(items.backendUrl || DEFAULT_BACKEND);
    });
  });
}

async function fetchMediaList() {
  const base = await getBackendUrl();
  try {
    const res = await fetch(base.replace(/\/$/, '') + '/api/list', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data.files) ? data.files : []);
    // 规范化：补齐 type / name 兜底
    return list
      .filter((f) => f && f.path)
      .map((f) => ({
        name: f.name || f.path.split('/').pop(),
        type: f.type || (/\.(mp3|ogg|wav|m4a|aac|flac)$/i.test(f.path) ? 'audio' : 'video'),
        path: f.path
      }));
  } catch (err) {
    console.warn('[background] 拉取后端清单失败，popup 将回退本地打包:', err);
    return [];
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'getMediaList') {
    fetchMediaList().then((files) => sendResponse({ ok: true, files }));
    return true; // 保持消息通道，等待异步响应
  }
});
