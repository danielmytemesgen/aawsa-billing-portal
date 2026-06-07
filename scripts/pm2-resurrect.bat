@echo off
:: Set the PM2_HOME path for the Administrator user
set PM2_HOME=C:\Users\Administrator\.pm2

:: Run resurrect using the absolute path to the global PM2 installation
call C:\Users\Administrator\AppData\Roaming\npm\pm2.cmd resurrect
