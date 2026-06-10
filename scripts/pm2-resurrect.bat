@echo off
:: Set the PM2_HOME path dynamically for the current user
set PM2_HOME=%USERPROFILE%\.pm2

:: Run resurrect using the dynamic APPDATA path to the global PM2 installation
call "%APPDATA%\npm\pm2.cmd" resurrect
