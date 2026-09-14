# Changelog

所有重要变更记录于此。格式参考 [Keep a Changelog](https://keepachangelog.com/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.2.6] - 2026-09-14

### 新增
- B 类播放交互增强（原生能力，无新依赖）：
  - 后台音频续播：新增 offscreen.html / offscreen.js + manifest `offscreen` 权限，关闭 popup 后音乐继续；popup 显示后台状态面板，媒体键经 service worker 转发控制；不支持时回退 popup 内播放。
  - 字幕 / 多语言：媒体项支持 `tracks`，视频渲染为多个 `<track>`（WebVTT），后端与本地清单均可透传。
  - 搜索与排序：播放列表支持按名称搜索、按名称/类型排序。
- popup.html / popup.css 增加搜索框、排序下拉与后台音频状态面板样式。

## [1.2.5] - 2026-09-14

### 新增
- 播放交互增强（A 类，均为原生 Web 能力，无新依赖）：
  - 媒体会话 Media Session API：锁屏元数据 + 硬件媒体键（播放/暂停/上下曲/快进快退跳转）；
  - 画中画（Picture-in-Picture）按钮（仅视频模式）；
  - 键盘快捷键：空格/k 播放暂停，←/→ 快退快进 5 秒，↑/↓ 音量，n/p 上下曲；
  - 进度记忆（chrome.storage.local）：按路径记录进度，重开自动恢复。
- popup.html / popup.css 增加画中画控件与样式。

## [1.2.4] - 2026-09-14

### 新增
- 最小自定义插件接口（plugins/plugin-api.js，约 40 行，无外部框架）：媒体源以插件注册，按优先级 fallback 链取数；内置「远端后端 / 本地打包」两个源，loadMedia 改为走插件收集。示例插件见 plugins/sample-source.js。
- README 补充「插件式媒体源」用法与「Codis / Cordis 架构选型笔记」。

## [1.2.3] - 2026-09-14

### 新增
- 接入 hls.js（本地打包于 `lib/hls.min.js`，Apache-2.0）实现 `.m3u8` / HLS 播放；`popup.js` 检测到 HLS 源时自动接管，Safari / iOS 走原生 HLS。
- 修正 manifest 版本号（v1.2.2 漏改，停留在 `1.2.1`）。

## [1.2.2] - 2026-09-14

### 修复
- 修正本地媒体列表写死四个示例文件名（`LOCAL_MEDIA`）导致用户自行放入的媒体不显示的问题。
  改为由 `media/manifest.json` 动态列出实际文件，并提供 `gen_media_manifest.py` / `.bat`
  扫描 `media/` 生成清单；放入新文件后重新运行脚本并刷新扩展即可列出。

## [1.2.1] - 2026-09-14

### 新增
- 选项页「测试连接」按钮：直接探测当前输入框地址的 `/api/list`，
  成功显示返回的媒体数量，失败显示错误原因，保存前即可确认后端可达。

## [1.2.0] - 2026-09-14

### 新增
- 扩展选项页 `options.html` / `options.css` / `options.js`（`manifest.json` 加 `options_page`）。
- 可视化配置后端地址，存储于 `chrome.storage.sync.backendUrl`；
  `background.js` 每次拉清单时实时读取，保存即对新 popup 生效。

## [1.1.0] - 2026-09-14

### 新增
- 混合媒体模式：background service worker（`background.js`）从后端拉取 `/api/list` 清单，
  并与随扩展打包的 `web_accessible_resources` 媒体并存。
- `manifest.json` 加入 `background`、`web_accessible_resources`、`storage` 与 `host_permissions`。
- `popup.js` 改为 `loadMedia()`：远端清单优先，本地打包兜底。
- 配套 Flask 示例后端 `server.py`（`/api/list` + `/media/<file>`）。

## [1.0.0] - 2026-09-14

### 初始版本
- 将单文件 HTML 播放器拆分为 Chrome / Edge 通用扩展（Manifest V3）：
  `manifest.json` + `popup.html` + `popup.css` + `popup.js`。
- 支持视频 / 音频混排播放列表、自动下一曲、音视频模式自动切换。
- 工程文件：`.gitignore`、`LICENSE`（MIT）、`requirements.txt`、`README.md`。


