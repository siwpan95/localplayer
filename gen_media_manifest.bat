@echo off
rem 2026-10-06 去符盘（铁律 5）：原写死旧机 python。
rem 优先用仓内 .venv，其次 PATH 上的 python —— 换机不再失效。
setlocal
set "PY=python"
if exist "%~dp0.venv\Scripts\python.exe" set "PY=%~dp0.venv\Scripts\python.exe"
"%PY%" "%~dp0gen_media_manifest.py"
endlocal