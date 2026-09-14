"""
Flask 示例后端：为扩展的「模式 B」提供媒体文件与清单 API。

运行：
    pip install -r requirements.txt
    python server.py
默认监听 http://127.0.0.1:5000

接口：
    GET /api/list          返回媒体清单 JSON 数组，每项 {name, path, type}
    GET /media/<filename>  返回 media/ 目录下的媒体文件

popup 通过 background service worker 调用 /api/list；返回的 path 为完整可访问 URL，
因此 popup 可直接作为 <video>/<audio> 的 src 使用。
"""
import os
from flask import Flask, send_from_directory, jsonify, request

BASE = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE, 'media')

app = Flask(__name__)

MEDIA_TYPES = {
    '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.mkv': 'video',
    '.mp3': 'audio', '.ogg': 'audio', '.wav': 'audio',
    '.m4a': 'audio', '.aac': 'audio', '.flac': 'audio',
}


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


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000)
