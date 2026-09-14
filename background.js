'use strict';

// MV3 service worker：负责从远端后端拉取媒体清单，
// 供 popup 通过 chrome.runtime.sendMessage 调用；
// 并管理 offscreen 文档用于后台音频续播。

const DEFAULT_BACKEND = 'http://127.0.0.1:5000';
const OFFSCREEN_URL = 'offscreen.html';

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
    // 规范化：补齐 type / name 兜底；透传 tracks（字幕）
    return list
      .filter((f) => f && f.path)
      .map((f) => ({
        name: f.name || f.path.split('/').pop(),
        type: f.type || (/\.(mp3|ogg|wav|m4a|aac|flac)$/i.test(f.path) ? 'audio' : 'video'),
        path: f.path,
        remote: true,
        tracks: Array.isArray(f.tracks) ? f.tracks : undefined
      }));
  } catch (err) {
    console.warn('[background] 拉取后端清单失败，popup 将回退本地打包:', err);
    return [];
  }
}

// ---------- offscreen 管理（后台音频） ----------
let lastOffscreenState = null;

async function ensureOffscreen() {
  if (typeof chrome === 'undefined' || !chrome.offscreen) return false;
  try {
    if (await chrome.offscreen.hasDocument?.().catch(() => false)) return true;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['AUDIO_PLAYBACK'],
      justification: '后台播放音频，使 popup 关闭后音乐继续'
    });
    return true;
  } catch (e) {
    console.warn('[background] 创建 offscreen 失败:', e);
    return false;
  }
}

function sendToOffscreen(cmd, extra) {
  if (!chrome.offscreen) return;
  chrome.runtime.sendMessage(Object.assign({ target: 'offscreen', cmd }, extra)).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  switch (msg.action) {
    case 'getMediaList':
      fetchMediaList().then((files) => sendResponse({ ok: true, files }));
      return true; // 保持消息通道，等待异步响应
    case 'ensureOffscreen':
      ensureOffscreen().then(sendResponse);
      return true;
    case 'audioLoad':
      ensureOffscreen().then((ok) => { if (ok) sendToOffscreen('load', { url: msg.url, meta: msg.meta }); });
      return false; // 无需回复调用方，offscreen 会直接回报状态
    case 'audioPlay':
      sendToOffscreen('play');
      return false;
    case 'audioPause':
      sendToOffscreen('pause');
      return false;
    case 'audioSeek':
      sendToOffscreen('seek', { time: msg.time });
      return false;
    case 'getOffscreenState':
      sendResponse(lastOffscreenState || { playing: false, currentTime: 0, duration: 0 });
      return true;
    case 'offscreenState':
      lastOffscreenState = msg; // 直接由 offscreen 广播给 popup，此处仅缓存
      return false;
    case 'offscreenEnded':
    case 'offscreenNext':
    case 'offscreenPrev':
      chrome.runtime.sendMessage(msg).catch(() => {}); // 转发给 popup（仅 popup 打开时有效）
      return false;
    default:
      return false;
  }
});
