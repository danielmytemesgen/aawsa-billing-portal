// server-https.js
// Custom HTTPS server for Next.js standalone output.
// This wraps the Next.js standalone server.js with native Node.js HTTPS support.
// Place this file next to server.js in .next/standalone/
//
// Usage: node server-https.js
// (PM2 will call this instead of server.js when HTTPS_CERT_FILE and HTTPS_KEY_FILE are set)

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createServer } = require('http');

const certFile = process.env.HTTPS_CERT_FILE;
const keyFile  = process.env.HTTPS_KEY_FILE;
const port     = parseInt(process.env.PORT || '443', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';

// ---- Validate cert/key files exist ----
if (!certFile || !keyFile) {
  console.error('[server-https] ERROR: HTTPS_CERT_FILE and HTTPS_KEY_FILE must be set in environment.');
  process.exit(1);
}

if (!fs.existsSync(certFile)) {
  console.error(`[server-https] ERROR: Certificate file not found: ${certFile}`);
  process.exit(1);
}

if (!fs.existsSync(keyFile)) {
  console.error(`[server-https] ERROR: Key file not found: ${keyFile}`);
  process.exit(1);
}

console.log(`[server-https] Loading certificate: ${certFile}`);
console.log(`[server-https] Loading key        : ${keyFile}`);

const tlsOptions = {
  cert: fs.readFileSync(certFile),
  key:  fs.readFileSync(keyFile),
};

// ---- Load the Next.js request handler ----
// next/standalone exports a handler via server.js
// We need to monkey-patch the http.createServer call to intercept it.
const originalCreateServer = http.createServer.bind(http);

let nextHandler = null;

http.createServer = function(optionsOrHandler, handler) {
  // Next.js calls http.createServer(handler) or http.createServer(options, handler)
  if (typeof optionsOrHandler === 'function') {
    nextHandler = optionsOrHandler;
    handler = optionsOrHandler;
  } else if (typeof handler === 'function') {
    nextHandler = handler;
  }

  // Return a dummy server that won't actually bind to anything
  const dummy = {
    listen: (p, h, cb) => { if (cb) cb(); return dummy; },
    on: () => dummy,
    once: () => dummy,
    emit: () => dummy,
    address: () => ({ port, family: 'IPv4', address: hostname }),
    close: (cb) => { if (cb) cb(); return dummy; },
  };
  return dummy;
};

// Load the Next.js standalone server (which calls http.createServer internally)
require('./server.js');

// Restore original
http.createServer = originalCreateServer;

if (!nextHandler) {
  console.error('[server-https] ERROR: Could not intercept Next.js request handler.');
  process.exit(1);
}

// ---- Start the real HTTPS server ----
const server = https.createServer(tlsOptions, nextHandler);

server.listen(port, hostname, (err) => {
  if (err) {
    console.error('[server-https] Failed to start HTTPS server:', err);
    process.exit(1);
  }
  console.log(`[server-https] ✅ HTTPS server listening on https://${hostname === '0.0.0.0' ? '10.10.254.78' : hostname}:${port === 443 ? '' : ':' + port}`);
  console.log('[server-https] Service Workers will register successfully over HTTPS.');
});

server.on('error', (err) => {
  console.error('[server-https] Server error:', err);
});
