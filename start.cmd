@echo off
title Lighthouse Island - walkabout
cd /d "%~dp0"
node server.mjs
if errorlevel 1 pause
