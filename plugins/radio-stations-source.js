// plugins/radio-stations-source.js
// 媒体源插件：把 C:\private-radio-stations-master 的媒体源接进本播放器。
//
// 数据不在扩展里，而由对端的聚合桥提供：
//   private-radio-stations 侧执行  npm run bridge  （或双击 start-bridge.bat）
//   它会起一个 http://127.0.0.1:8787 的服务，把「电台直播 / 电台预设 / IPTV 频道 /
//   录制回放 / MediaMTX HLS」聚合成本扩展认识的清单：
//     GET /api/list -> [ { name, path, type: 'audio'|'video', ... } ]
//
// 为什么走插件而不是改 popup.js：
//   popup.js 的 loadMedia() 就是 LocalPlayer.plugins.collectMedia()，按 priority
//   从高到低取第一个「返回非空列表」的源。所以这里只注册、不侵入。
//
// 优先级 15：高于后端（10）、样例（5）、本地打包（0）。
//   —— 桥在线就用它；桥不在线（最常见：对端没启动）就以 LP_SILENT 抛错，
//      collectMedia 会**静默**跳到下一个源，不刷控制台、不弹错。
//
// 只做播放，不做控制：不调用对端的 /api/relay/start 之类写接口，
// 启停转播仍然在 private-radio-stations 自己的面板上做。
(function () {
    'use strict';

    var DEFAULT_BASE = 'http://127.0.0.1:8787';
    var STORAGE_KEY = 'radioBridgeUrl';
    var TIMEOUT_MS = 2000;

    // 地址可配（选项页「联动桥地址」）；读不到就用默认值，绝不因为配置缺失而失败。
    function readBase() {
        return new Promise(function (resolve) {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                    var cfg = {};
                    cfg[STORAGE_KEY] = DEFAULT_BASE;
                    chrome.storage.sync.get(cfg, function (got) {
                        resolve(String((got && got[STORAGE_KEY]) || DEFAULT_BASE).replace(/\/+$/, ''));
                    });
                    return;
                }
            } catch (e) { /* 非扩展环境（如本地起个静态页调试）走默认 */ }
            resolve(DEFAULT_BASE);
        });
    }

    if (!window.LocalPlayer || !window.LocalPlayer.plugins) {
        // plugin-api.js 没先加载：静默退出，别把整页脚本搞崩。
        console.warn('LocalPlayer: radio-stations 源未注册（plugin-api.js 未加载）');
        return;
    }

    window.LocalPlayer.plugins.register({
        id: 'radio-stations',
        name: 'private-radio-stations 联动',
        priority: 15,

        async getMedia() {
            const base = await readBase();
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
            try {
                const resp = await fetch(base + '/api/list', {
                    signal: ctrl.signal,
                    cache: 'no-store',
                });
                if (!resp.ok) throw new Error('LP_SILENT: 联动桥 HTTP ' + resp.status);
                const items = await resp.json();
                if (!Array.isArray(items)) throw new Error('LP_SILENT: 联动桥返回非数组');
                // 过滤掉缺字段的脏数据，避免后面播放时拿到 undefined 的 src
                const clean = items.filter((it) => it && it.path && (it.type === 'audio' || it.type === 'video'));
                if (!clean.length) throw new Error('LP_SILENT: 联动桥暂无可播内容（对端未转播或无频道）');
                return clean;
            } finally {
                clearTimeout(timer);
            }
        },
    });
})();
