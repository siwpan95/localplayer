'use strict';

const DEFAULT_BACKEND = 'http://127.0.0.1:5000';
const DEFAULT_BRIDGE = 'http://127.0.0.1:8787';

const input = document.getElementById('backendUrl');
const bridgeInput = document.getElementById('radioBridgeUrl');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const testBridgeBtn = document.getElementById('testBridgeBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');

let statusTimer = null;

function showStatus(msg, type) {
    const cls = (type === 'ok' || type === 'err' || type === 'info') ? type : (type ? 'ok' : 'err');
    statusEl.className = 'status ' + cls;
    statusEl.textContent = msg;
    statusEl.hidden = false;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { statusEl.hidden = true; }, 2500);
}

function isValidUrl(v) {
    try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

function load() {
    chrome.storage.sync.get(
        { backendUrl: DEFAULT_BACKEND, radioBridgeUrl: DEFAULT_BRIDGE },
        (items) => {
            input.value = items.backendUrl || '';
            // 老配置里没有这个键时给默认值，别让输入框空着
            bridgeInput.value = items.radioBridgeUrl || DEFAULT_BRIDGE;
        }
    );
}

function save() {
    const v = input.value.trim();
    if (v && !isValidUrl(v)) {
        showStatus('地址格式无效，需以 http:// 或 https:// 开头', 'err');
        return;
    }
    const b = (bridgeInput.value || '').trim();
    if (b && !isValidUrl(b)) {
        showStatus('联动桥地址格式无效，需以 http:// 或 https:// 开头', 'err');
        return;
    }
    chrome.storage.sync.set({ backendUrl: v, radioBridgeUrl: b || DEFAULT_BRIDGE }, () => {
        showStatus(v ? '已保存：' + v : '已保存（使用本地打包媒体）', 'ok');
    });
}

/**
 * 测试联动桥：探 /api/health 而不是 /api/list ——
 * 桥「活着但什么都没列出来」是最常见的状态（对端没转播 / 没频道），
 * 只看清单数量会让人以为是连不上。health 会区分这两种。
 */
async function testBridge() {
    const v = (bridgeInput.value || '').trim();
    if (!v) {
        showStatus('请先填写联动桥地址再测试', 'err');
        return;
    }
    if (!isValidUrl(v)) {
        showStatus('联动桥地址格式无效，需以 http:// 或 https:// 开头', 'err');
        return;
    }
    showStatus('正在测试联动桥…', 'info');
    try {
        const res = await fetch(v.replace(/\/+$/, '') + '/api/health', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const h = await res.json();
        if (h && h.hasMedia) {
            showStatus('联动桥正常，清单 ' + h.total + ' 条', 'ok');
            return;
        }
        // 桥活着但没内容：把原因说清楚，别只报「失败」
        const bad = (h.sources || []).filter((s) => s.state === 'error');
        const why = bad.length
            ? bad.map((s) => `${s.id}(${s.error})`).join('、')
            : '对端未转播或无频道/录制';
        showStatus('桥在线但暂无可播内容：' + why, 'err');
    } catch (e) {
        showStatus('联动桥连接失败：' + e.message + '（对端执行 npm run bridge 了吗？）', 'err');
    }
}

// 测试连接：直接探测输入框当前地址的 /api/list，与是否保存无关
async function testConnection() {
    const v = input.value.trim();
    if (!v) {
        showStatus('请先填写后端地址再测试', 'err');
        return;
    }
    if (!isValidUrl(v)) {
        showStatus('地址格式无效，需以 http:// 或 https:// 开头', 'err');
        return;
    }
    showStatus('正在测试连接…', 'info');
    try {
        const res = await fetch(v.replace(/\/$/, '') + '/api/list', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const n = Array.isArray(data) ? data.length : (Array.isArray(data.files) ? data.files.length : 0);
        showStatus('连接成功，清单返回 ' + n + ' 个媒体', 'ok');
    } catch (e) {
        showStatus('连接失败：' + e.message, 'err');
    }
}

function reset() {
    input.value = DEFAULT_BACKEND;
    bridgeInput.value = DEFAULT_BRIDGE;
    chrome.storage.sync.set(
        { backendUrl: DEFAULT_BACKEND, radioBridgeUrl: DEFAULT_BRIDGE },
        () => {
            showStatus('已恢复默认：' + DEFAULT_BACKEND, 'ok');
        }
    );
}

saveBtn.addEventListener('click', save);
testBtn.addEventListener('click', testConnection);
testBridgeBtn.addEventListener('click', testBridge);
resetBtn.addEventListener('click', reset);
load();
