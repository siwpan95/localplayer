#!/usr/bin/env python3
"""无头自检：Flask 后端 API、媒体清单生成、版本一致性校验。

只 import server 的 Flask app（用 test_client，不监听端口）、gen_media_manifest、
check_version 的纯逻辑，不会创建 Tkinter 窗口或启动服务。
运行：python selfcheck.py
"""
import contextlib
import io
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def fail(msg):
    print(f"FAIL: {msg}")
    raise SystemExit(1)


def _run_quiet(func, *args):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        result = func(*args)
    return result, buf.getvalue()


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    try:
        import check_version
        import gen_media_manifest
        import server
    except Exception as exc:  # pragma: no cover
        fail(f"导入项目模块失败: {exc}")

    # ---------- 1. Flask 后端：/api/list 与 /remote ----------
    client = server.app.test_client()
    resp = client.get("/api/list")
    if resp.status_code != 200:
        fail(f"/api/list 返回 {resp.status_code}")
    items = resp.get_json()
    if not isinstance(items, list) or not items:
        fail("/api/list 未返回媒体清单")
    expected = set()
    if os.path.isdir(server.MEDIA_DIR):
        for fn in os.listdir(server.MEDIA_DIR):
            if os.path.splitext(fn)[1].lower() in server.MEDIA_TYPES:
                expected.add(fn)
    got = {item.get("name") for item in items}
    if got != expected:
        fail(f"/api/list 清单与 media/ 目录不一致: {len(got)} vs {len(expected)}")
    for item in items:
        name = item.get("name", "")
        if set(item) != {"name", "path", "type"}:
            fail(f"/api/list 条目字段不符: {item}")
        if item["type"] != server.MEDIA_TYPES[os.path.splitext(name)[1].lower()]:
            fail(f"/api/list 类型标注错误: {name}")
        if not item["path"].endswith("/media/" + name):
            fail(f"/api/list 媒体 URL 错误: {item['path']}")
    if client.get("/remote").status_code != 200:
        fail("/remote 观看页不可用")
    if b"WebRTC" not in client.get("/remote").data:
        fail("/remote 页面内容异常")

    # ---------- 2. 版本一致性校验（真实仓库 + 构造的不一致样例） ----------
    manifest_v = check_version.manifest_version()
    changelog_v = check_version.latest_changelog_version()
    if manifest_v is None or changelog_v is None:
        fail("无法解析 manifest.json / CHANGELOG.md 版本号")
    rc, _ = _run_quiet(check_version.main)
    if rc != 0:
        fail(f"仓库版本不一致: manifest={manifest_v}, changelog={changelog_v}")

    original_manifest = check_version.MANIFEST
    original_changelog = check_version.CHANGELOG
    try:
        with tempfile.TemporaryDirectory() as tmp:
            fake_manifest = Path(tmp) / "manifest.json"
            fake_changelog = Path(tmp) / "CHANGELOG.md"
            fake_manifest.write_text(json.dumps({"version": "9.9.9"}), encoding="utf-8")
            fake_changelog.write_text(
                "## [1.0.0] - 2024-01-01\n## [0.9.0] - 2023-12-01\n", encoding="utf-8"
            )
            check_version.MANIFEST = fake_manifest
            check_version.CHANGELOG = fake_changelog
            rc_bad, _ = _run_quiet(check_version.main)
            fake_changelog.write_text("## [9.9.9] - 2024-01-01\n", encoding="utf-8")
            rc_ok, _ = _run_quiet(check_version.main)
        if rc_bad != 1 or rc_ok != 0:
            fail(f"版本校验判定错误: 不一致应返回 1（实际 {rc_bad}），一致应返回 0（实际 {rc_ok}）")
    finally:
        check_version.MANIFEST = original_manifest
        check_version.CHANGELOG = original_changelog

    # ---------- 3. 媒体清单生成：过滤规则 + 相对路径 + JSON 往返 ----------
    original_media_dir = gen_media_manifest.MEDIA_DIR
    try:
        with tempfile.TemporaryDirectory() as tmp:
            media_dir = Path(tmp) / "media"
            (media_dir / "nested").mkdir(parents=True)
            for name in ("clip.mp4", "song.mp3", "nested/extra.webm"):
                (media_dir / name).write_bytes(b"stub")
            for name in ("seg.ts", "README.md", "notes.txt"):
                (media_dir / name).write_text("skip", encoding="utf-8")
            gen_media_manifest.MEDIA_DIR = str(media_dir)
            _run_quiet(gen_media_manifest.main)
            manifest_path = media_dir / "manifest.json"
            if not manifest_path.is_file():
                fail("gen_media_manifest 未写出 manifest.json")
            entries = json.loads(manifest_path.read_text(encoding="utf-8"))
    finally:
        gen_media_manifest.MEDIA_DIR = original_media_dir

    by_file = {entry["file"]: entry for entry in entries}
    if set(by_file) != {"clip.mp4", "song.mp3", "nested/extra.webm"}:
        fail(f"媒体清单过滤/路径错误: {sorted(by_file)}")
    expected_types = {"clip.mp4": "video", "song.mp3": "audio", "nested/extra.webm": "video"}
    for file, mtype in expected_types.items():
        if by_file[file]["type"] != mtype or by_file[file]["name"] != os.path.basename(file):
            fail(f"媒体清单条目错误: {by_file[file]}")

    print(
        "selfcheck ok: Flask /api/list（清单与 media/ 文件一致）与 /remote、"
        "版本一致性校验（一致=0 / 不一致=1）、媒体清单生成（含 .ts/README 过滤与子目录相对路径）"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
