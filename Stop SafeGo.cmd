@echo off
rem Double-click to stop SafeGo if a window was closed but SafeGo is still running.
cd /d "%~dp0"
call npm run stop
pause
