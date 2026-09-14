(function() {
    'use strict';

    // ---------- 配置：媒体文件列表 ----------
    // 注意：如果通过 Flask 后端访问，请保留 /media/ 前缀。
    // 直接以 file:// 打开时，请将文件放在同目录下并去掉 /media/ 前缀。
    const USE_FLASK_BACKEND = true;  // 设为 false 可本地直接播放同目录文件

    // 示例媒体清单（实际项目中可由后端 API 动态提供）
    const mediaFiles = [
        { name: '示例视频 1.mp4',  path: '/media/sample1.mp4',  type: 'video' },
        { name: '示例视频 2.webm', path: '/media/sample2.webm', type: 'video' },
        { name: '示例音频 1.mp3',  path: '/media/sample_audio1.mp3', type: 'audio' },
        { name: '示例音频 2.ogg',  path: '/media/sample_audio2.ogg', type: 'audio' }
    ];

    // 如果关闭后端模式，去掉路径中的 /media/ 前缀
    const files = USE_FLASK_BACKEND
        ? mediaFiles
        : mediaFiles.map(f => ({ ...f, path: f.path.replace(/^\/media\//, '') }));

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

        // 隐藏视频元素，创建音频元素
        player.style.display = 'none';

        // 移除旧的 audio（如果有）
        const oldAudio = document.getElementById('audioPlayer');
        if (oldAudio) oldAudio.remove();

        const audio = document.createElement('audio');
        audio.id = 'audioPlayer';
        audio.controls = true;
        audio.preload = 'metadata';
        // 音频模式下容器高度自适应
        mediaWrapper.style.aspectRatio = 'auto';
        mediaWrapper.style.padding = '12px 0';
        mediaWrapper.appendChild(audio);

        // 将事件绑定迁移到 audio（简单做法：播放逻辑通过统一入口控制，不依赖元素事件）
        // 这里我们不在 audio 上绑定 ended，而是在播放逻辑中统一处理。
        // 但为了自动下一曲，需监听 audio 的 ended 事件：
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

        // 更新当前播放名称
        currentMediaNameEl.textContent = file.name;

        // 更新高亮状态
        document.querySelectorAll('.playlist-item').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });

        // 根据类型切换播放器
        if (file.type === 'audio') {
            const audio = switchToAudioMode();
            audio.src = file.path;
            audio.load();
            audio.play().catch(err => {
                console.warn('音频播放失败（可能需用户交互）:', err);
            });
            // 确保视频元素停止
            player.pause();
        } else {
            switchToVideoMode();
            player.src = file.path;
            player.load();
            player.play().catch(err => {
                console.warn('视频播放失败（可能需用户交互）:', err);
            });
            // 确保音频元素停止（switchToVideoMode 已处理）
        }
    }

    // ---------- 渲染播放列表 ----------
    function renderPlaylist() {
        playlistEl.innerHTML = '';

        if (files.length === 0) {
            playlistEl.innerHTML = '<div class="empty-msg">📭 暂无媒体文件<br><span style="font-size:0.8rem;">请将视频/音频放入 media 目录</span></div>';
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

    // ---------- 初始化：尝试自动播放第一个文件 ----------
    function init() {
        renderPlaylist();

        if (files.length > 0) {
            // 预加载第一个文件的信息但不自动播放（浏览器策略限制）
            currentMediaNameEl.textContent = files[0].name;
            // 设置第一个为高亮
            const firstItem = document.querySelector('.playlist-item[data-index="0"]');
            if (firstItem) firstItem.classList.add('active');
            currentIndex = 0;

            // 设置视频源（不自动播放，等待用户点击）
            const firstFile = files[0];
            if (firstFile.type === 'video') {
                player.src = firstFile.path;
                player.load();
            } else {
                // 如果是音频，预创建音频元素但不播放
                const audio = switchToAudioMode();
                audio.src = firstFile.path;
                audio.load();
            }
        }
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
