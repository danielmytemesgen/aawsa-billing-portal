#!/bin/bash
# ====================================================================
# AAWSA Billing Portal - Session Monitoring Sweep (Linux/Mac)
# Closes staff sessions idle longer than the configured session duration
# (default 7200s = 2h). Credentials come from the app's own .env.local /
# .env.production via dotenv - no secrets here.
#
# Schedule via cron (see docs/USER_SESSION_MONITORING_PLAN.md):
#   0 3 * * * /path/to/project/scripts/devops/session-sweep.sh >> /var/log/aawsa_session_sweep.log 2>&1
# ====================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "${SCRIPT_DIR}/../.." || exit 1

mkdir -p logs

echo "[AAWSA Session Sweep] Started $(date)" >> "logs/session-sweep.log"
npm run session-sweep >> "logs/session-sweep.log" 2>&1
EXIT_CODE=$?
echo "[AAWSA Session Sweep] Finished (exit code ${EXIT_CODE}) $(date)" >> "logs/session-sweep.log"

exit $EXIT_CODE
