@echo off
rem Double-click to start SafeGo on recorded weather when the internet is down. A banner marks it as a replay.
cd /d "%~dp0"
call npm run presentation:replay
pause
