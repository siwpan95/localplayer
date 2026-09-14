# Changelog

所有重要变更记录于此。格式参考 [Keep a Changelog](https://keepachangelog.com/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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


