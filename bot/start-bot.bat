@echo off
chcp 65001 >nul
title Ritm bot
cd /d "%~dp0.."
:loop
node bot\bot.mjs
echo Bot stopped. Restarting in 5 seconds... (close this window to stop)
timeout /t 5 >nul
goto loop
