import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env if .env.local not found

/**
 * Automated SLA Escalation Sweep Worker (CLI & Cron Entrypoint).
 * 
 * Flags overdue support tickets:
 *   - Level 1 (Branch Supervisor): unresolved after 24h
 *   - Level 2 (Head Office): unresolved after 48h
 * 
 * Can be scheduled via:
 *   - Linux Crontab:
 *     * /15 * * * * cd /path/to/app && npm run escalation-sweep >> logs/escalation-sweep.log 2>&1
 *   - Windows Task Scheduler:
 *     schtasks /Create /SC MINUTE /MO 15 /TN "AAWSA SLA Escalation Sweep" /TR "npx tsx src/scripts/escalation-sweep.ts"
 */

async function runSweep() {
  console.log(`[${new Date().toISOString()}] Starting AAWSA Support SLA Escalation Sweep...`);
  
  const { checkAndEscalateTickets } = await import('../lib/escalation');
  const result = await checkAndEscalateTickets();

  console.log(`[${new Date().toISOString()}] SLA Sweep finished successfully:`);
  console.log(`  - Total active tickets inspected: ${result.totalChecked}`);
  console.log(`  - Newly escalated tickets: ${result.escalatedCount}`);
  console.log(`    * Level 1 (Branch Supervisor - 24h): ${result.level1Count}`);
  console.log(`    * Level 2 (Head Office - 48h): ${result.level2Count}`);

  if (result.escalatedTickets && result.escalatedTickets.length > 0) {
    console.log('  - Escalation details:');
    for (const t of result.escalatedTickets) {
      console.log(`    #${t.ticketNumber} [${t.branch || 'Global'}] -> Level ${t.level} (${t.hours}h elapsed)`);
    }
  }

  process.exit(0);
}

runSweep().catch((err) => {
  console.error(`[${new Date().toISOString()}] SLA Escalation Sweep failed:`, err);
  process.exit(1);
});
