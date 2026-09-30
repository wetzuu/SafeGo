@echo off
rem Double-click to start SafeGo for a presentation. Keep this window open; close it or press Ctrl+C to stop.
cd /d "%~dp0"
call npm run presentation
pause
