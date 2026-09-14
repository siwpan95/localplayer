"""
Flask 示例后端：为扩展的「模式 B」提供媒体文件与清单 API，并承载 WebRTC 信令与
「网页投送」的外部观看页。

运行：
    pip install -r requirements.txt
    python server.py
默认监听 http://127.0.0.1:5000

接口：
    GET  /api/list           媒体清单 JSON 数组，每项 {name, path, type}
    GET  /media/<filename>   返回 media/ 目录下的媒体文件
    WS   /ws                 WebRTC 信令中继（offscreen 发送端 <-> 外部网页观看端）
    GET  /remote             外部观看页（接收 offscreen 经 WebRTC 投送的音视频）
"""
import os
import json
from flask import Flask, send_from_directory, jsonify, request
from flask_sock import Sock

BASE = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE, 'media')

app = Flask(__name__)
sock = Sock(app)

MEDIA_TYPES = {
    '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.mkv': 'video',
    '.mp3': 'audio', '.ogg': 'audio', '.wav': 'audio',
    '.m4a': 'audio', '.aac': 'audio', '.flac': 'audio',
}

# ---------- 信令中继：单一发送端 + 单一观看端 ----------
_peers = {'sender': None, 'viewer': None}


def _relay_to_other(role, msg):
    other = _peers['viewer'] if role == 'sender' else _peers['sender']
    if other is not None:
        try:
            other.send(json.dumps(msg))
        except Exception:
            pass


@sock.route('/ws')
def ws_signaling(ws):
    role = None
    try:
        while True:
            data = ws.receive()
            if data is None:
                break
            msg = json.loads(data)
            mtype = msg.get('type')
            if mtype == 'role':
                role = msg.get('role')
                _peers[role] = ws
                # 双方就位后，请发送端发起 offer
                if _peers['sender'] is not None and _peers['viewer'] is not None:
                    try:
                        _peers['sender'].send(json.dumps({'type': 'offer-request'}))
                    except Exception:
                        pass
            else:
                _relay_to_other(role, msg)
    finally:
        for k in ('sender', 'viewer'):
            if _peers.get(k) is ws:
                _peers[k] = None


@app.route('/api/list')
def media_list():
    items = []
    if os.path.isdir(MEDIA_DIR):
        for fn in sorted(os.listdir(MEDIA_DIR)):
            ext = os.path.splitext(fn)[1].lower()
            mtype = MEDIA_TYPES.get(ext)
            if mtype:
                items.append({
                    'name': fn,
                    'path': request.host_url.rstrip('/') + '/media/' + fn,
                    'type': mtype,
                })
    return jsonify(items)


@app.route('/media/<path:filename>')
def media_file(filename):
    return send_from_directory(MEDIA_DIR, filename)


@app.route('/remote')
def remote_viewer():
    return REMOTE_HTML


REMOTE_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>轻量播放器 · 网页投送</title>
<style>
  body{margin:0;background:#0f0f12;color:#eaeef2;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px}
  h1{font-size:1.1rem;font-weight:500;color:#b9c4d0}
  video{width:min(90vw,960px);background:#000;border-radius:16px;box-shadow:0 20px 40px -12px rgba(0,0,0,.8)}
  #status{font-size:.85rem;color:#8a98a8}
  button{background:#2e4b7c;color:#fff;border:none;border-radius:30px;padding:8px 18px;cursor:pointer;font-size:.85rem}
</style>
</head>
<body>
  <h1>🔊 网页投送（WebRTC）</h1>
  <video id="rv" autoplay playsinline controls></video>
  <div id="status">正在连接信令…</div>
  <button id="reconnect">重新连接</button>
<script>
const video = document.getElementById('rv');
const statusEl = document.getElementById('status');
let pc = null, ws = null;
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function connect() {
  statusEl.textContent = '正在连接信令…';
  ws = new WebSocket('ws://' + location.host + '/ws');
  ws.onopen = () => { ws.send(JSON.stringify({ type: 'role', role: 'viewer' })); statusEl.textContent = '已就位，等待投送…'; };
  ws.onmessage = async (e) => {
    const m = JSON.parse(e.data);
    if (m.type === 'offer') {
      pc = new RTCPeerConnection(rtcConfig);
      pc.ontrack = (ev) => { video.srcObject = ev.streams[0]; };
      pc.onicecandidate = (ev) => { if (ev.candidate) ws.send(JSON.stringify({ type: 'candidate', candidate: ev.candidate })); };
      await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
      statusEl.textContent = '接收中…';
    } else if (m.type === 'candidate') {
      try { await pc.addIceCandidate(m.candidate); } catch (e) {}
    }
  };
  ws.onclose = () => { statusEl.textContent = '信令断开'; };
  ws.onerror = () => { statusEl.textContent = '信令错误'; };
}
document.getElementById('reconnect').onclick = () => { if (pc) { pc.close(); pc = null; } connect(); };
connect();
</script>
</body>
</html>"""


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000)
