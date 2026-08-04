@echo off
setlocal
cd /d "%~dp0"
title 光谱优化器本地测试服务
where node >nul 2>nul
if errorlevel 1 (
    echo 未找到 Node.js，请先安装 Node.js 后再运行。
    pause
    exit /b 1
)
node local-server.js
if errorlevel 1 pause
