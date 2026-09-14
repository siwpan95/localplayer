'use strict';

// offscreen 文档：在 MV3 中承载「后台音频」播放。
// popup 关闭后，service worker 仍可向本页发指令，使音乐继续播放；
// 播放进度经 chrome.storage.local 落盘（与 popup 内播放共用 lp_progress），重开可续播。

const audio = document.getElementById('bg');

let currentPath = '';     // 当前音频的 path（进度落盘键）
let currentTitle = '';    // 当前音频标题（回报 UI）
let pendingStart = 0;     // 待恢复的起始进度（秒）

// ---------- 进度落盘 ----------
let progressCache = {};
let progressSaveTimer = null;

function loadProgress() {
    return new Promise((resolve) => {
        chrome.storage.local.get('lp_progress', (r) => {
            if (r && r.lp_progress && typeof r.lp_progress === 'object') {
                Object.assign(progressCache, r.lp_progress);
            }
            resolve();
        });
    });
}

function saveProgress(time) {
    if (!currentPath || !isFinite(time) || time <= 0) return;
    progressCache[currentPath] = time;
    if (progressSaveTimer) clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(() => {
        chrome.storage.local.set({ lp_progress: progressCache });
    }, 1000);
}

function flushProgress() {
    if (progressSaveTimer) {
        clearTimeout(progressSaveTimer);
        progressSaveTimer = null;
    }
    if (currentPath && isFinite(audio.currentTime) && audio.currentTime > 0) {
        progressCache[currentPath] = audio.currentTime;
        chrome.storage.local.set({ lp_progress: progressCache });
    }
}

function setPlaybackState(s) {
    if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = s; } catch (e) { /* ignore */ }
    }
}

function postState() {
    chrome.runtime.sendMessage({
        action: 'offscreenState',
        playing: !audio.paused,
        currentTime: audio.currentTime,
        duration: isFinite(audio.duration) ? audio.duration : 0,
        url: currentPath,
        title: currentTitle
    }).catch(() => {});
}

audio.addEventListener('timeupdate', () => { saveProgress(audio.currentTime); postState(); });
audio.addEventListener('play', () => { setPlaybackState('playing'); postState(); });
audio.addEventListener('pause', () => { setPlaybackState('paused'); flushProgress(); postState(); });
audio.addEventListener('ended', () => { flushProgress(); chrome.runtime.sendMessage({ action: 'offscreenEnded' }).catch(() => {}); });
audio.addEventListener('loadedmetadata', () => {
    // 元数据就绪后恢复上次进度
    if (pendingStart > 0 && isFinite(audio.duration) && pendingStart < audio.duration - 1) {
        try { audio.currentTime = pendingStart; } catch (e) { /* ignore */ }
    }
    pendingStart = 0;
});

function setMeta(meta) {
    if (!('mediaSession' in navigator) || !meta) return;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: meta.title || '音频',
            artist: meta.artist || '',
            album: meta.album || '轻量播放器'
        });
        navigator.mediaSession.playbackState = 'playing';
    } catch (e) { /* ignore */ }
}

if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const safe = (fn) => (d) => { try { fn(d); } catch (e) { /* ignore */ } };
    ms.setActionHandler('play', safe(() => audio.play().catch(() => {})));
    ms.setActionHandler('pause', safe(() => audio.pause()));
    ms.setActionHandler('nexttrack', safe(() => chrome.runtime.sendMessage({ action: 'offscreenNext' }).catch(() => {})));
    ms.setActionHandler('previoustrack', safe(() => chrome.runtime.sendMessage({ action: 'offscreenPrev' }).catch(() => {})));
    ms.setActionHandler('seekto', safe((d) => { if (d.seekTime != null) audio.currentTime = d.seekTime; }));
    ms.setActionHandler('seekbackward', safe((d) => { audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)); }));
    ms.setActionHandler('seekforward', safe((d) => { audio.currentTime = Math.min((audio.duration || 1e9), audio.currentTime + (d.seekOffset || 10)); }));
}

chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.target !== 'offscreen') return;
    switch (msg.cmd) {
        case 'load':
            currentPath = msg.url || '';
            currentTitle = msg.meta ? (msg.meta.title || '') : '';
            pendingStart = (typeof msg.startTime === 'number' && msg.startTime > 0) ? msg.startTime : 0;
            audio.src = msg.url;
            audio.load();
            setMeta(msg.meta);
            audio.play().catch((e) => console.warn('后台播放失败:', e));
            break;
        case 'play':
            audio.play().catch(() => {});
            break;
        case 'pause':
            audio.pause();
            break;
        case 'seek':
            if (typeof msg.time === 'number') audio.currentTime = msg.time;
            break;
        case 'stop':
            flushProgress();
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            currentPath = '';
            break;
    }
});

loadProgress();
