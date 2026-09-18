@echo off
title RTD Logo Studio
set NODE=node
where node >nul 2>nul
if errorlevel 1 set NODE=C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-3\node.exe
"%NODE%" "%~dp0server.js"
pause
