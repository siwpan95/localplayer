'use strict';

const DEFAULT_BACKEND = 'http://127.0.0.1:5000';

const input = document.getElementById('backendUrl');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');

function showStatus(msg, ok) {
    statusEl.textContent = msg;
    statusEl.className = 'status ' + (ok ? 'ok' : 'err');
    statusEl.hidden = false;
    setTimeout(() => { statusEl.hidden = true; }, 2500);
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
    chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND }, (items) => {
        input.value = items.backendUrl || '';
    });
}

function save() {
    const v = input.value.trim();
    if (v && !isValidUrl(v)) {
        showStatus('地址格式无效，需以 http:// 或 https:// 开头', false);
        return;
    }
    chrome.storage.sync.set({ backendUrl: v }, () => {
        showStatus(v ? '已保存：' + v : '已保存（使用本地打包媒体）', true);
    });
}

function reset() {
    input.value = DEFAULT_BACKEND;
    chrome.storage.sync.set({ backendUrl: DEFAULT_BACKEND }, () => {
        showStatus('已恢复默认：' + DEFAULT_BACKEND, true);
    });
}

saveBtn.addEventListener('click', save);
resetBtn.addEventListener('click', reset);
load();
