# media 目录

把视频 / 音频文件放在这个目录即可被播放器识别，两种模式都用到它：

- **模式 A（随扩展打包）**：文件随扩展分发，`popup.js` 通过
  `chrome.runtime.getURL('media/xxx')` 访问（需 `manifest.json` 中已声明
  `web_accessible_resources`）。
- **模式 B（后端）**：`server.py` 扫描本目录，经 `/api/list` 返回清单，
  由 background service worker 拉取后传给 popup。

支持的扩展名见 `server.py` 的 `MEDIA_TYPES`（mp4/webm/mov/mkv/mp3/ogg/wav/m4a/aac/flac）。
二进制媒体不随仓库提交（见 `.gitignore`），请自行放入。

> 此目录下的媒体文件由用户自行放置、不纳入版本管理。
