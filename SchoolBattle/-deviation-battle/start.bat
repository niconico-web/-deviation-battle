@echo off
chcp 65001 >nul
cd /d "%~dp0server"
echo Starting School Battle server...
echo Open http://localhost:3000 in your browser
start "" "http://localhost:3000"
node server.js
pause
