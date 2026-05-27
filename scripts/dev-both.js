// scripts/dev-both.js
// -------------------------------------------------
// This script starts two Next.js dev servers:
//   • HTTP  on port 3000
//   • HTTPS on port 3001 (uses Next’s experimental‑https flag)
// -------------------------------------------------

const { spawn } = require('child_process');

function launch(cmd, args, name) {
  const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
  proc.on('close', code => {
    console.log(`\n[${name}] exited with code ${code}`);
    process.exit(code);
  });
}

// HTTP server (plain)
launch('npm', ['run', 'dev-http'], 'HTTP');

// HTTPS server (experimental flag)
launch('npm', ['run', 'dev-https'], 'HTTPS');
