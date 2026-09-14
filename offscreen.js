'use strict';

// offscreen 文档：在 MV3 中承载「后台音频」播放。
// popup 关闭后，service worker 仍可向本页发指令，使音乐继续播放。

const audio = document.getElementById('bg');

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
        duration: isFinite(audio.duration) ? audio.duration : 0
    }).catch(() => {});
}

audio.addEventListener('timeupdate', postState);
audio.addEventListener('play', () => { setPlaybackState('playing'); postState(); });
audio.addEventListener('pause', () => { setPlaybackState('paused'); postState(); });
audio.addEventListener('ended', () => chrome.runtime.sendMessage({ action: 'offscreenEnded' }).catch(() => {}));

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
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            break;
    }
});
