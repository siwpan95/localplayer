(function() {
    'use strict';

    // ---------- DOM 引用 ----------
    const player = document.getElementById('player');
    const mediaWrapper = document.getElementById('mediaWrapper');
    const playlistEl = document.getElementById('playlist');
    const fileCountEl = document.getElementById('fileCount');
    const currentMediaNameEl = document.getElementById('currentMediaName');
    const nowPlayingEl = document.getElementById('nowPlaying');

    // ---------- 状态 ----------
    let currentIndex = -1;
    let isAudioMode = false;   // 当前是否为音频模式
    let files = [];            // 媒体清单（由混合加载填充）

    // ---------- 本地打包媒体（随扩展分发，由 media/manifest.json 动态列出） ----------
    // 扩展运行时无法枚举自身包内目录，故由 gen_media_manifest.py 扫描 media/ 生成清单，
    // popup 读取该清单得到实际存在的媒体文件（避免硬编码示例文件名）。
    async function loadBundledMedia() {
        try {
            const res = await fetch(chrome.runtime.getURL('media/manifest.json'), { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const list = await res.json();
            if (Array.isArray(list) && list.length) {
                return list.map(m => ({
                    name: m.name,
                    type: m.type,
                    path: chrome.runtime.getURL('media/' + m.file),
                    bundled: true
                }));
            }
        } catch (e) {
            console.warn('读取本地媒体清单失败，请先运行 gen_media_manifest.py:', e);
        }
        return [];
    }

    // ---------- 混合加载：远端清单优先，本地打包兜底 ----------
    async function loadMedia() {
        let remote = [];
        try {
            const resp = await chrome.runtime.sendMessage({ action: 'getMediaList' });
            if (resp && resp.ok && Array.isArray(resp.files)) {
                remote = resp.files.map(f => ({
                    name: f.name,
                    type: f.type,
                    path: f.path,
                    remote: true
                }));
            }
        } catch (e) {
            console.warn('获取远端清单失败，回退到本地打包媒体:', e);
        }
        // 远端有内容用远端；否则读取随扩展打包的 media/manifest.json
        return remote.length ? remote : await loadBundledMedia();
    }

    // ---------- 工具函数 ----------
    function getIconForType(type) {
        return type === 'audio' ? '🎧' : '🎬';
    }

    function formatBadge(type) {
        return type === 'audio' ? 'AUDIO' : 'VIDEO';
    }

    // ---------- 切换到音频模式 ----------
    function switchToAudioMode() {
        if (isAudioMode) return;
        isAudioMode = true;

        player.style.display = 'none';

        const oldAudio = document.getElementById('audioPlayer');
        if (oldAudio) oldAudio.remove();

        const audio = document.createElement('audio');
        audio.id = 'audioPlayer';
        audio.controls = true;
        audio.preload = 'metadata';
        mediaWrapper.style.aspectRatio = 'auto';
        mediaWrapper.style.padding = '12px 0';
        mediaWrapper.appendChild(audio);

        audio.addEventListener('ended', handleEnded);

        return audio;
    }

    // ---------- 切换回视频模式 ----------
    function switchToVideoMode() {
        if (!isAudioMode) return;
        isAudioMode = false;

        const audio = document.getElementById('audioPlayer');
        if (audio) {
            audio.pause();
            audio.removeEventListener('ended', handleEnded);
            audio.remove();
        }

        player.style.display = 'block';
        mediaWrapper.style.aspectRatio = '16 / 9';
        mediaWrapper.style.padding = '0';
    }

    // ---------- 播放结束处理 ----------
    function handleEnded() {
        if (currentIndex >= 0 && currentIndex + 1 < files.length) {
            playByIndex(currentIndex + 1);
        }
    }

    // ---------- HLS（.m3u8）播放支持 ----------
    // MV3 禁止运行时加载远程脚本，故 hls.min.js 以本地资源打包（见 popup.html）。
    let hlsInstance = null;

    function destroyHls() {
        if (hlsInstance) {
            try { hlsInstance.destroy(); } catch (e) { /* ignore */ }
            hlsInstance = null;
        }
    }

    function isHlsSource(path) {
        return /\.m3u8(\?[^#]*)?$/i.test(path);
    }

    // 给媒体元素挂载源：HLS 走 hls.js，普通格式直连；autoplay 控制是否立即播放
    function attachSource(el, file, autoplay) {
        destroyHls();
        const doPlay = () => {
            if (autoplay) {
                el.play().catch(err => console.warn('播放失败（可能需用户交互）:', err));
            }
        };

        if (isHlsSource(file.path) && window.Hls && Hls.isSupported()) {
            hlsInstance = new Hls();
            hlsInstance.loadSource(file.path);
            hlsInstance.attachMedia(el);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, doPlay);
            hlsInstance.on(Hls.Events.ERROR, (evt, data) => {
                if (data && data.fatal) console.warn('HLS 致命错误:', data.type, data.details);
            });
        } else if (isHlsSource(file.path) && el.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari / iOS 原生支持 HLS
            el.src = file.path;
            el.load();
            doPlay();
        } else {
            el.src = file.path;
            el.load();
            doPlay();
        }
    }

    // ---------- 核心播放函数 ----------
    function playByIndex(index) {
        if (index < 0 || index >= files.length) return;
        currentIndex = index;
        const file = files[index];

        currentMediaNameEl.textContent = file.name;

        document.querySelectorAll('.playlist-item').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });

        if (file.type === 'audio') {
            const audio = switchToAudioMode();
            attachSource(audio, file, true);
            player.pause();
        } else {
            switchToVideoMode();
            attachSource(player, file, true);
        }
    }

    // ---------- 渲染播放列表 ----------
    function renderPlaylist() {
        playlistEl.innerHTML = '';

        if (files.length === 0) {
            playlistEl.innerHTML = '<div class="empty-msg">📭 暂无媒体文件<br><span style="font-size:0.8rem;">请运行 gen_media_manifest.py 生成清单，或启动 Flask 后端</span></div>';
            fileCountEl.textContent = '0 个文件';
            return;
        }

        fileCountEl.textContent = files.length + ' 个文件';

        files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.index = index;

            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = getIconForType(file.type);

            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = file.name;

            const badge = document.createElement('span');
            badge.className = 'type-badge';
            badge.textContent = formatBadge(file.type);

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(badge);

            item.addEventListener('click', () => {
                playByIndex(index);
            });

            playlistEl.appendChild(item);
        });
    }

    // ---------- 视频元素自带 ended 事件（用于视频模式自动下一曲） ----------
    player.addEventListener('ended', handleEnded);

    // ---------- 初始化 ----------
    async function init() {
        files = await loadMedia();
        renderPlaylist();

        if (files.length > 0) {
            currentMediaNameEl.textContent = files[0].name;
            const firstItem = document.querySelector('.playlist-item[data-index="0"]');
            if (firstItem) firstItem.classList.add('active');
            currentIndex = 0;

            const firstFile = files[0];
            if (firstFile.type === 'video') {
                attachSource(player, firstFile, false);
            } else {
                const audio = switchToAudioMode();
                attachSource(audio, firstFile, false);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
