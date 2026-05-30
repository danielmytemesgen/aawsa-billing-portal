// scripts/dev-both.js
// Updated script to run both dev servers concurrently and handle graceful shutdown.
// -------------------------------------------------
// This script starts two Next.js dev servers:
//   • HTTP  on port 3000
//   • HTTPS on port 3001 (uses Next’s experimental‑https flag)
// -------------------------------------------------

const { spawn } = require('child_process');

// Keep track of child processes
const children = [];
let exitCodes = [];
let closedCount = 0;

function launch(cmd, args, name) {
  const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
  children.push(proc);
  proc.on('close', code => {
    console.log(`\n[${name}] exited with code ${code}`);
    exitCodes.push(code);
    closedCount++;
    // If both children have closed, exit the parent with appropriate code
    if (closedCount === 2) {
      // Use the first non‑zero exit code if any, otherwise 0
      const finalCode = exitCodes.find(c => c !== 0) || 0;
      process.exit(finalCode);
    }
  });
}

// HTTP server (plain)
launch('npx', ['next', 'dev', '-p', '3000'], 'HTTP');

// HTTPS server (experimental flag)
launch('npx', ['next', 'dev', '--experimental-https', '-p', '3001'], 'HTTPS');

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down child processes...');
  // Terminate all child processes
  children.forEach(proc => {
    try {
      proc.kill('SIGINT');
    } catch (_) {}
  });
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down child processes...');
  children.forEach(proc => {
    try {
      proc.kill('SIGTERM');
    } catch (_) {}
  });
  process.exit();
});
