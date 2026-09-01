@echo off
rem ============================================================
rem  NorthUnity — one-click starter
rem  Opens two windows: the API (port 8787) and the app (5173),
rem  then opens the app in your browser.
rem  (Postgres runs as a Windows service and starts by itself.)
rem ============================================================

start "NorthUnity API (8787) - keep open" cmd /k "cd /d "%~dp0server" && node src\index.js"
start "NorthUnity App (5173) - keep open" cmd /k "cd /d "%~dp0app" && npm run dev"

rem give the dev server a moment, then open the browser
timeout /t 6 /nobreak >nul
start http://localhost:5173
