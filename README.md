# 轻量播放器 · 本地媒体（Chrome / Edge 通用扩展）

一个以浏览器扩展（Manifest V3）形式分发的轻量本地媒体播放器，
支持视频 / 音频混排播放列表、自动下一曲、音频 / 视频模式自动切换。

Chrome 与 Edge 使用同一套 MV3 规范，本扩展在两者上通用，无需改动。

## 目录结构

```
localplayer/
├── manifest.json     # MV3 扩展清单（action.default_popup → popup.html）
├── popup.html        # 弹窗页面结构
├── popup.css         # 样式
├── popup.js          # 播放逻辑（渲染列表 / 切换音视频 / 自动连播）
├── requirements.txt  # 可选 Flask 后端依赖
├── LICENSE           # MIT
└── README.md
```

> `deepseek_html_20260914_584fc0.html` 为拆分前的单文件源，保留作参考。

## 加载方式

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）。
2. 右上角开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本目录 `localplayer`。
4. 点击工具栏图标，弹出播放器。

## 媒体来源（两种模式）

`popup.js` 顶部 `USE_FLASK_BACKEND` 控制媒体清单来源。两种模式可同时存在（见下文「混合模式」）。

### 模式 A：随扩展打包 + `web_accessible_resources`

把媒体文件直接放进扩展目录，并在 `manifest.json` 声明：

```json
"web_accessible_resources": [{
  "resources": ["media/*"],
  "matches": ["<all_urls>"]
}]
```

`popup.js` 中将路径改写为
`chrome-extension://<扩展ID>/media/xxx.mp4`。
媒体随扩展分发，无需后端，完全离线可用。

### 模式 B：走 background service worker 拉取后端清单

1. 用 `requirements.txt` 里的 Flask 起一个后端，提供 `/media/<file>` 与 `/api/list`。
2. 新增 `background.js`（MV3 service worker）暴露
   `chrome.runtime.onMessage` 监听，由它 `fetch` 后端清单后回传。
3. `popup.js` 通过 `chrome.runtime.sendMessage` 取清单，再逐条播放。
   后端地址等可存于 `chrome.storage`。

### 混合模式（A + B 同时实现）

**可以同时实现。** 两者并不冲突，只是「媒体清单与文件的来源」不同：

- `web_accessible_resources` 解决「扩展内打包文件如何被 popup 访问」；
- background service worker 解决「如何异步从远端后端拿清单」。

实现策略：popup 启动时先问 background 拿远端清单；
若拿到且非空 → 用后端模式（模式 B）；若 background 无响应 / 未配置后端
→ 回退到扩展内打包的 `web_accessible_resources` 文件（模式 A）。
最终 `files` 数组由「远端清单 ∪ 本地打包文件」合并而成，互不干扰。

## 许可

MIT License，见 [LICENSE](LICENSE)。
