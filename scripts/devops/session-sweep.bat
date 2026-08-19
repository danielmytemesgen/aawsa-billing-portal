@echo off
SETLOCAL
:: ====================================================================
:: AAWSA Billing Portal - Session Monitoring Sweep (Windows)
:: Closes staff sessions that have been idle longer than the configured
:: session duration (default 7200s = 2h). Credentials come from the app's
:: own .env.local / .env.production via dotenv - no secrets here.
::
:: Schedule via Windows Task Scheduler (see docs/WINDOWS_SERVER_DEPLOYMENT.md):
::   schtasks /Create /SC DAILY /ST 03:00 /TN "AAWSA Session Sweep" ^
::     /TR "C:\Apps\aawsa-billing-portal\scripts\devops\session-sweep.bat" /F
:: ====================================================================

:: Change to the project root (parent of this script's directory)
cd /d "%~dp0..\.."

:: Create the logs directory if it doesn't exist
IF NOT EXIST "logs" mkdir "logs"

echo [AAWSA Session Sweep] Started %date% %time% >> "logs\session-sweep.log"
call npm run session-sweep >> "logs\session-sweep.log" 2>&1
SET EXIT_CODE=%ERRORLEVEL%
echo [AAWSA Session Sweep] Finished (exit code %EXIT_CODE%) %date% %time% >> "logs\session-sweep.log"

ENDLOCAL
exit /b %EXIT_CODE%
