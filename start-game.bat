@echo off
cd /d "%~dp0"
echo Starting Doudizhu on http://localhost:5179 ...
start "" cmd /c "timeout /t 6 >nul && start http://localhost:5179"
npm run dev:h5 -- --port 5179
