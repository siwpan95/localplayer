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

    // ---------- 本地打包媒体（随扩展分发，经 web_accessible_resources 暴露） ----------
    const LOCAL_MEDIA = [
        { name: '示例视频 1.mp4',  file: 'media/sample1.mp4',        type: 'video' },
        { name: '示例视频 2.webm', file: 'media/sample2.webm',       type: 'video' },
        { name: '示例音频 1.mp3',  file: 'media/sample_audio1.mp3',  type: 'audio' },
        { name: '示例音频 2.ogg',  file: 'media/sample_audio2.ogg',  type: 'audio' }
    ].map(m => ({
        name: m.name,
        type: m.type,
        path: chrome.runtime.getURL(m.file),
        bundled: true
    }));

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
        // 远端有内容用远端；否则用随扩展打包的媒体
        return remote.length ? remote : LOCAL_MEDIA;
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
            audio.src = file.path;
            audio.load();
            audio.play().catch(err => {
                console.warn('音频播放失败（可能需用户交互）:', err);
            });
            player.pause();
        } else {
            switchToVideoMode();
            player.src = file.path;
            player.load();
            player.play().catch(err => {
                console.warn('视频播放失败（可能需用户交互）:', err);
            });
        }
    }

    // ---------- 渲染播放列表 ----------
    function renderPlaylist() {
        playlistEl.innerHTML = '';

        if (files.length === 0) {
            playlistEl.innerHTML = '<div class="empty-msg">📭 暂无媒体文件<br><span style="font-size:0.8rem;">请启动后端或将媒体放入 media 目录</span></div>';
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
                player.src = firstFile.path;
                player.load();
            } else {
                const audio = switchToAudioMode();
                audio.src = firstFile.path;
                audio.load();
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
