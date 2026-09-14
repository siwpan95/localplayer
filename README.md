# 轻量播放器 · 本地媒体（Chrome / Edge 通用扩展）

一个以浏览器扩展（Manifest V3）形式分发的轻量本地媒体播放器，
支持视频 / 音频混排播放列表、自动下一曲、音频 / 视频模式自动切换。

Chrome 与 Edge 使用同一套 MV3 规范，本扩展在两者上通用，无需改动。

## 目录结构

```
localplayer/
├── manifest.json     # MV3 扩展清单（popup + options_page + background + web_accessible_resources）
├── popup.html        # 弹窗页面结构
├── popup.css         # 弹窗样式
├── popup.js          # 播放逻辑（混合加载：远端优先 + 本地打包兜底）
├── lib/hls.min.js     # 本地打包的 hls.js（Apache-2.0），用于播放 .m3u8
├── options.html      # 选项页结构
├── options.css       # 选项页样式
├── options.js        # 选项页逻辑（读写后端地址到 chrome.storage.sync）
├── background.js     # MV3 service worker（拉取后端 /api/list 清单）
├── server.py         # 可选 Flask 后端（/api/list + /media/<file>）
├── gen_media_manifest.py       # 扫描 media/ 生成本地媒体清单 media/manifest.json
├── gen_media_manifest.bat      # 同上（Windows 双击运行）
├── media/            # 随扩展打包的媒体（含 README 说明与 manifest.json 清单）
├── requirements.txt  # 可选 Flask 后端依赖
├── CHANGELOG.md      # 版本变更记录
├── LICENSE           # MIT
└── README.md
```

> `deepseek_html_20260914_584fc0.html` 为拆分前的单文件源，保留作参考。

## 加载方式

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）。
2. 右上角开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本目录 `localplayer`。
4. 点击工具栏图标，弹出播放器。

## 选项页（配置后端地址）

右键扩展图标 → 「选项」，或在 `chrome://extensions` 详情页点击「扩展选项」，打开设置页：

- **后端地址 (Backend URL)**：填写你的 Flask 后端基址（默认 `http://127.0.0.1:5000`）。
  `background.js` 每次拉清单时都会读取 `chrome.storage.sync.backendUrl`，保存后立即对新打开的 popup 生效。
- 留空或格式无效 → popup 回退到随扩展打包的本地媒体。
- 「测试连接」：直接探测当前输入框地址的 `/api/list`（与是否保存无关），
  成功时显示返回的媒体数量，失败给出错误原因，便于保存前确认后端可达。
- 「恢复默认」一键重置为 `http://127.0.0.1:5000`。

## 媒体来源（两种模式）

`popup.js` 的 `loadMedia()` 决定媒体清单来源。两种模式可同时存在（见下文「混合模式」）。

### 模式 A：随扩展打包 + `web_accessible_resources`

把媒体文件放进 `media/` 目录，并在 `manifest.json` 声明：

```json
"web_accessible_resources": [{
  "resources": ["media/*"],
  "matches": ["<all_urls>"]
}]
```

扩展运行时**无法枚举自身包内目录**，所以本地媒体清单由 `gen_media_manifest.py`（或 `gen_media_manifest.bat`）
扫描 `media/` 生成 `media/manifest.json`，`popup.js` 读取该清单得到实际文件，路径形如
`chrome-extension://<扩展ID>/media/xxx.mp4`。**放入新文件后需重新运行生成脚本并刷新扩展**，popup 才会列出它们。
媒体随扩展分发，无需后端，完全离线可用。

### 模式 B：走 background service worker 拉取后端清单

1. 用 `requirements.txt` 里的 Flask 起一个后端，提供 `/media/<file>` 与 `/api/list`。
2. 新增 `background.js`（MV3 service worker）暴露
   `chrome.runtime.onMessage` 监听，由它 `fetch` 后端清单后回传。
3. `popup.js` 通过 `chrome.runtime.sendMessage` 取清单，再逐条播放。
   后端地址等可存于 `chrome.storage`。

### 混合模式（A + B 已同时实现）

两者并不冲突，已默认开启：

- `web_accessible_resources`（`manifest.json`）解决「扩展内打包文件如何被 popup 访问」；
- background service worker（`background.js`）解决「如何异步从远端后端拿清单」。

**实现（`popup.js` 的 `loadMedia()`）**：popup 启动先 `chrome.runtime.sendMessage({action:'getMediaList'})`
向 `background.js` 取远端清单；`background.js` 用 `fetch` 调用后端 `/api/list`（地址来自
`chrome.storage.sync.backendUrl`，默认 `http://127.0.0.1:5000`，可覆盖）。若远端返回非空 →
用后端模式（B）；若拉取失败 / 后端未起 → 回退到 `media/manifest.json` 列出的本地打包文件（A）。
两种来源互不干扰，最终统一进 `files` 数组。

**配套 Flask 后端**：`server.py` 提供 `GET /api/list`（返回 `{name,path,type}` 数组，
`path` 为完整 URL）与 `GET /media/<file>`。运行见文件头注释。

## HLS（.m3u8）播放

`index.m3u8` 这类 HLS 播放列表，Chrome 原生 `<video>` 无法直接播放。本项目在 `lib/hls.min.js`
本地打包 [hls.js](https://github.com/video-dev/hls.js)（Apache-2.0；因 MV3 禁止运行时加载远程脚本，必须本地打包），
`popup.js` 检测到 `.m3u8` 源时自动用 hls.js 接管播放（Safari / iOS 走原生 HLS）。

> 注意：`.ts` 分片由 `.m3u8` 引用，无需（也不应）单独列出，生成清单时已被 `gen_media_manifest.py` 跳过。

## 许可

MIT License，见 [LICENSE](LICENSE)。

第三方依赖：[hls.js](https://github.com/video-dev/hls.js)（Apache-2.0）以本地资源 `lib/hls.min.js` 打包，用于 `.m3u8` 播放。
