@echo off
chcp 65001 >nul
echo ========================================================
echo   落第骑士英雄谭 — WORLD ATLAS 地图册预览服务
echo ========================================================
echo.
echo 正在启动本地服务器并打开浏览器...
start "" http://localhost:8088
python -m http.server 8088
pause
