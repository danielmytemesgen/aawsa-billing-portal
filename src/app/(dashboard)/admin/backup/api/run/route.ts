import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants/auth';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import net from 'net';
import zlib from 'zlib';

const BACKUP_BASE = process.env.BACKUP_DIR || 'C:\\aawsa\\backups';
const LOG_FILE = process.env.BACKUP_LOG_FILE || 'C:\\aawsa\\backup.log';
const JOB_DIR = path.join(BACKUP_BASE, '.jobs');

function writeJob(jobId: string, update: object) {
  try {
    if (!fs.existsSync(JOB_DIR)) fs.mkdirSync(JOB_DIR, { recursive: true });
    const existing = readJob(jobId) || {};
    fs.writeFileSync(path.join(JOB_DIR, `${jobId}.json`), JSON.stringify({ ...existing, ...update }));
  } catch (_) {}
}

function readJob(jobId: string) {
  try {
    const p = path.join(JOB_DIR, `${jobId}.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (_) { return null; }
}

function appendJobLog(jobId: string, line: string) {
  try {
    const p = path.join(JOB_DIR, `${jobId}.log`);
    fs.appendFileSync(p, line + '\n');
  } catch (_) {}
}

function readJobLog(jobId: string): string[] {
  try {
    const p = path.join(JOB_DIR, `${jobId}.log`);
    if (!fs.existsSync(p)) return [];
    return fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean);
  } catch (_) { return []; }
}

// ── pg_dump binary auto-detection ────────────────────────────────────────────
function findPgDump(): string {
  if (process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) {
    return process.env.PG_DUMP_PATH;
  }
  const winVersions = ['17', '16', '15', '14', '13'];
  for (const ver of winVersions) {
    const p = `C:\\Program Files\\PostgreSQL\\${ver}\\bin\\pg_dump.exe`;
    if (fs.existsSync(p)) return p;
    const p2 = `C:\\Program Files (x86)\\PostgreSQL\\${ver}\\bin\\pg_dump.exe`;
    if (fs.existsSync(p2)) return p2;
  }
  const unixPaths = [
    '/usr/bin/pg_dump', '/usr/local/bin/pg_dump',
    '/usr/lib/postgresql/17/bin/pg_dump', '/usr/lib/postgresql/16/bin/pg_dump',
    '/usr/lib/postgresql/15/bin/pg_dump', '/opt/homebrew/bin/pg_dump',
  ];
  for (const p of unixPaths) { if (fs.existsSync(p)) return p; }
  return 'pg_dump'; // PATH fallback
}

// ── Stale job auto-recovery ───────────────────────────────────────────────────
function recoverStaleJobs() {
  try {
    if (!fs.existsSync(JOB_DIR)) return;
    const STALE_MS = 5 * 60 * 1000;
    fs.readdirSync(JOB_DIR).filter(f => f.endsWith('.json')).forEach(f => {
      try {
        const p = path.join(JOB_DIR, f);
        const job = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (job.status !== 'running') return;
        const logPath = path.join(JOB_DIR, f.replace('.json', '.log'));
        const lastActivity = fs.existsSync(logPath)
          ? fs.statSync(logPath).mtimeMs
          : new Date(job.startedAt || 0).getTime();
        if (Date.now() - lastActivity > STALE_MS) {
          fs.writeFileSync(p, JSON.stringify({
            ...job, status: 'failed', progress: 0,
            error: 'Job timed out or was interrupted (auto-recovered after 5 min inactivity).',
            finishedAt: new Date().toISOString(),
          }));
        }
      } catch (_) {}
    });
  } catch (_) {}
}

// ── Retention Pruning ────────────────────────────────────────────────────────
function pruneOldBackups(dailyDir: string, jobId?: string): { prunedCount: number; prunedFiles: string[] } {
  try {
    if (!fs.existsSync(dailyDir)) return { prunedCount: 0, prunedFiles: [] };

    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);
    if (isNaN(retentionDays) || retentionDays <= 0) return { prunedCount: 0, prunedFiles: [] };

    const files = fs.readdirSync(dailyDir)
      .filter(f => f.endsWith('.sql.gz'))
      .map(f => {
        const fullPath = path.join(dailyDir, f);
        const stats = fs.statSync(fullPath);
        return { name: f, fullPath, mtime: stats.mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime); // newest first

    // Safety guard: always keep at least the latest 3 backups
    const MIN_BACKUPS_TO_KEEP = 3;
    if (files.length <= MIN_BACKUPS_TO_KEEP) {
      return { prunedCount: 0, prunedFiles: [] };
    }

    const now = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
    const candidates = files.slice(MIN_BACKUPS_TO_KEEP);
    const prunedFiles: string[] = [];

    for (const file of candidates) {
      if (now - file.mtime > maxAgeMs) {
        try {
          fs.unlinkSync(file.fullPath);
          const shaFile = file.fullPath + '.sha256';
          if (fs.existsSync(shaFile)) fs.unlinkSync(shaFile);
          prunedFiles.push(file.name);
          if (jobId) {
            appendJobLog(jobId, `[${new Date().toISOString()}] 🗑️ Pruned expired backup (> ${retentionDays}d): ${file.name}`);
          }
        } catch (e: any) {
          if (jobId) {
            appendJobLog(jobId, `[${new Date().toISOString()}] ⚠️ Failed to prune ${file.name}: ${e.message}`);
          }
        }
      }
    }

    return { prunedCount: prunedFiles.length, prunedFiles };
  } catch (err) {
    return { prunedCount: 0, prunedFiles: [] };
  }
}

// ── Secondary Directory Mirroring ─────────────────────────────────────────────
function mirrorToSecondary(compressedFile: string, jobId?: string): { mirrored: boolean; destination?: string; error?: string } {
  const secondaryDir = process.env.BACKUP_SECONDARY_DIR?.trim();
  if (!secondaryDir) return { mirrored: false };

  try {
    if (!fs.existsSync(secondaryDir)) {
      fs.mkdirSync(secondaryDir, { recursive: true });
    }
    const filename = path.basename(compressedFile);
    const destGz = path.join(secondaryDir, filename);
    const destSha = path.join(secondaryDir, filename + '.sha256');

    fs.copyFileSync(compressedFile, destGz);
    const srcSha = compressedFile + '.sha256';
    if (fs.existsSync(srcSha)) {
      fs.copyFileSync(srcSha, destSha);
    }

    if (jobId) {
      appendJobLog(jobId, `[${new Date().toISOString()}] 📂 Mirrored backup to secondary storage: ${destGz}`);
    }
    return { mirrored: true, destination: destGz };
  } catch (err: any) {
    if (jobId) {
      appendJobLog(jobId, `[${new Date().toISOString()}] ⚠️ Secondary mirror failed: ${err.message}`);
    }
    return { mirrored: false, error: err.message };
  }
}

// POST /admin/backup/api/run — starts backup asynchronously, returns jobId immediately
export async function POST(request: Request) {
  try {
    const session = await getSession();
    let callerName = session?.email || session?.id || 'admin';
    let isAuthorized = false;

    if (session?.id) {
      const perms: string[] = session.permissions || [];
      if (perms.includes(PERMISSIONS.SETTINGS_MANAGE) || perms.includes('*') || perms.includes('all')) {
        isAuthorized = true;
      }
    }

    // Support headless cron secret via x-cron-secret header or Authorization: Bearer <secret>
    const cronSecret = process.env.BACKUP_CRON_SECRET;
    const reqCronSecret = request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!isAuthorized && cronSecret && reqCronSecret && reqCronSecret === cronSecret) {
      isAuthorized = true;
      callerName = 'Automated Scheduler (Cron)';
    }

    if (!isAuthorized) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Handle body actions
    let body: any = {};
    try { body = await request.json(); } catch (_) {}

    // Handle manual prune action
    if (body?.action === 'prune') {
      const dailyDir = path.join(BACKUP_BASE, 'daily');
      const pruneResult = pruneOldBackups(dailyDir);
      return NextResponse.json({
        success: true,
        message: `Pruning complete. Removed ${pruneResult.prunedCount} old backup(s).`,
        prunedCount: pruneResult.prunedCount,
        prunedFiles: pruneResult.prunedFiles,
      });
    }

    // Handle cancel/reset action
    if (body?.action === 'cancel' && body?.jobId) {
      const job = readJob(body.jobId);
      if (job) {
        writeJob(body.jobId, {
          status: 'failed',
          error: 'Cancelled by user.',
          finishedAt: new Date().toISOString(),
          progress: 0,
        });
        appendJobLog(body.jobId, `[${new Date().toISOString()}] 🛑 Job cancelled by ${callerName}`);
      }
      return NextResponse.json({ cancelled: true });
    }

    // Auto-recover any stale stuck jobs
    recoverStaleJobs();

    // Check if a backup is already running
    if (fs.existsSync(JOB_DIR)) {
      const runningJob = fs.readdirSync(JOB_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => { try { return JSON.parse(fs.readFileSync(path.join(JOB_DIR, f), 'utf-8')); } catch { return null; } })
        .filter(Boolean)
        .find((j: any) => j.status === 'running');
      if (runningJob) {
        return NextResponse.json({ jobId: runningJob.jobId, alreadyRunning: true, message: 'A backup is already in progress' });
      }
    }

    const pgDumpBin = findPgDump();
    const jobId = crypto.randomBytes(8).toString('hex');
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad2(now.getMonth()+1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    const dailyDir = path.join(BACKUP_BASE, 'daily');
    const tag = callerName.includes('Cron') ? 'scheduled' : 'manual';
    const compressedFile = path.join(dailyDir, `aawsa_${dateStr}_${tag}.sql.gz`);

    writeJob(jobId, {
      jobId,
      status: 'running',
      startedAt: now.toISOString(),
      startedBy: callerName,
      outputFile: compressedFile,
      filename: path.basename(compressedFile),
      progress: 0,
      pgDumpBin,
    });
    appendJobLog(jobId, `[${now.toISOString()}] 🚀 Backup started by ${callerName}`);
    appendJobLog(jobId, `[${now.toISOString()}] 🔍 pg_dump binary: ${pgDumpBin}`);

    runBackupJob(jobId, dailyDir, compressedFile, now, pgDumpBin).catch(err => {
      writeJob(jobId, { status: 'failed', error: err?.message || 'Unknown error', finishedAt: new Date().toISOString(), progress: 0 });
      appendJobLog(jobId, `[${new Date().toISOString()}] ❌ ERROR: ${err?.message || 'Unknown error'}`);
    });

    return NextResponse.json({ jobId, started: true, message: 'Backup started in background' });

  } catch (error: any) {
    console.error('Start backup error:', error);
    return NextResponse.json({ message: error?.message || 'Server error' }, { status: 500 });
  }
}

// GET /admin/backup/api/run?jobId=xxx — poll for job status + live log
export async function GET(request: Request) {
  try {
    const session = await getSession();
    let isAuthorized = Boolean(session?.id);

    const cronSecret = process.env.BACKUP_CRON_SECRET;
    const reqCronSecret = request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!isAuthorized && cronSecret && reqCronSecret && reqCronSecret === cronSecret) {
      isAuthorized = true;
    }

    if (!isAuthorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    if (!jobId || !/^[a-f0-9]{16}$/.test(jobId)) {
      return NextResponse.json({ message: 'Invalid jobId' }, { status: 400 });
    }

    // Auto-recover stale jobs on each poll
    recoverStaleJobs();

    const job = readJob(jobId);
    if (!job) return NextResponse.json({ message: 'Job not found' }, { status: 404 });

    const logs = readJobLog(jobId);
    return NextResponse.json({ ...job, logs });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Server error' }, { status: 500 });
  }
}

// ── Background backup runner ──────────────────────────────────────────────────
async function runBackupJob(
  jobId: string,
  dailyDir: string,
  compressedFile: string,
  startTime: Date,
  pgDumpBin: string,
): Promise<void> {
  const ts = () => `[${new Date().toISOString()}]`;

  const dbHost     = process.env.POSTGRES_HOST     || process.env.PGHOST     || '127.0.0.1';
  const dbPort     = process.env.POSTGRES_PORT     || process.env.PGPORT     || '5432';
  const dbUser     = process.env.POSTGRES_USER     || process.env.PGUSER     || 'postgres';
  const dbName     = process.env.POSTGRES_DB       || process.env.PGDATABASE || 'aawsa_billing';
  const dbPassword = process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '';

  // Step 1: Ensure output directory exists
  if (!fs.existsSync(dailyDir)) fs.mkdirSync(dailyDir, { recursive: true });
  appendJobLog(jobId, `${ts()} 📁 Output directory ready: ${dailyDir}`);
  writeJob(jobId, { progress: 5, step: 'Preparing directories' });

  // Step 2: TCP connectivity pre-flight (pure Node.js — no pg_isready binary needed)
  appendJobLog(jobId, `${ts()} 🔌 Checking DB at ${dbHost}:${dbPort}...`);
  writeJob(jobId, { progress: 10, step: 'Checking DB connectivity' });

  const tcpReachable = await new Promise<boolean>(resolve => {
    const socket = net.createConnection({ host: dbHost, port: parseInt(dbPort, 10) }, () => {
      socket.destroy(); resolve(true);
    });
    socket.setTimeout(5000);
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });

  if (!tcpReachable) {
    appendJobLog(jobId, `${ts()} ⚠️  TCP probe failed — trying pg_dump anyway (may use Unix socket)...`);
  } else {
    appendJobLog(jobId, `${ts()} ✅ DB reachable at ${dbHost}:${dbPort}`);
  }
  writeJob(jobId, { progress: 15, step: 'DB connection verified' });

  // Step 3: Single-pass stream — pg_dump stdout → hash + gzip → file
  // Eliminates redundant disk passes: no intermediate .sql file needed.
  appendJobLog(jobId, `${ts()} 📦 Starting single-pass pg_dump → gzip stream...`);
  writeJob(jobId, { progress: 20, step: 'Starting pg_dump (streaming)' });

  const result = await new Promise<{ ok: boolean; rawBytes: number; sha256: string; error?: string }>(resolve => {
    let rawBytes = 0;
    let tableCount = 0;
    let stderrBuf = '';
    let settled = false;
    const settle = (val: { ok: boolean; rawBytes: number; sha256: string; error?: string }) => {
      if (!settled) { settled = true; resolve(val); }
    };

    const pgDump = spawn(pgDumpBin, [
      '-h', dbHost, '-p', dbPort, '-U', dbUser, '-d', dbName,
      '--no-owner', '--no-acl',
      '-v',      // verbose → emits table names on stderr in real-time
      '-F', 'p', // plain text format on stdout
    ], {
      env: { ...process.env, PGPASSWORD: dbPassword },
      windowsHide: true,
    });

    const hash = crypto.createHash('sha256');
    const gzip = zlib.createGzip({ level: 6 });
    const writeStream = fs.createWriteStream(compressedFile);

    // Parse pg_dump verbose stderr for real table-level progress
    pgDump.stderr?.on('data', (d: Buffer) => {
      stderrBuf += d.toString();
      const lines = stderrBuf.split('\n');
      stderrBuf = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Match: pg_dump: dumping contents of table "schema"."table" or table "table"
        const tableMatch = trimmed.match(/dumping contents of table "?[^"]*"?\."?([^"]+)"?/i)
          || trimmed.match(/dumping contents of table "?([^"]+)"?/i);
        if (tableMatch) {
          tableCount++;
          const tbl = tableMatch[1];
          // Progress ramps from 20% → 80% as tables are streamed
          const progress = Math.min(80, 20 + Math.floor(tableCount * 1.5));
          writeJob(jobId, { progress, step: `Dumping: ${tbl} (${tableCount} tables)` });
          appendJobLog(jobId, `${ts()} 📋 Dumping table: ${tbl}`);
        }
      }
    });

    // Intercept stdout to measure raw bytes and feed gzip
    pgDump.stdout?.on('data', (chunk: Buffer) => {
      rawBytes += chunk.length;
      const ok = gzip.write(chunk);
      if (!ok) {
        // Back-pressure: pause stdout until gzip drains
        pgDump.stdout?.pause();
        gzip.once('drain', () => pgDump.stdout?.resume());
      }
    });

    // Hash compressed archive bytes on-the-fly for .sha256 checksum file
    gzip.on('data', (compressedChunk: Buffer) => {
      hash.update(compressedChunk);
    });

    pgDump.stdout?.on('end', () => gzip.end());

    pgDump.on('error', (err: NodeJS.ErrnoException) => {
      const hint = err.code === 'ENOENT'
        ? ` — pg_dump binary not found at "${pgDumpBin}". Set PG_DUMP_PATH in .env.local.`
        : '';
      settle({ ok: false, rawBytes, sha256: '', error: `${err.message}${hint}` });
    });

    pgDump.on('close', (code) => {
      if (!settled && code !== 0) {
        gzip.end();
        settle({ ok: false, rawBytes, sha256: '', error: stderrBuf.slice(-500) || `pg_dump exited with code ${code}` });
      }
    });

    gzip.pipe(writeStream);

    writeStream.on('finish', () => {
      if (!settled) settle({ ok: true, rawBytes, sha256: hash.digest('hex') });
    });

    writeStream.on('error', (err) => {
      settle({ ok: false, rawBytes, sha256: '', error: `Write error: ${err.message}` });
    });

    // Safety timeout: 10 minutes
    const timeout = setTimeout(() => {
      pgDump.kill('SIGKILL');
      settle({ ok: false, rawBytes, sha256: '', error: 'pg_dump timed out after 10 minutes' });
    }, 10 * 60 * 1000);
    writeStream.on('finish', () => clearTimeout(timeout));
    writeStream.on('error', () => clearTimeout(timeout));
  });

  if (!result.ok) {
    appendJobLog(jobId, `${ts()} ❌ pg_dump failed: ${result.error}`);
    writeJob(jobId, { status: 'failed', error: result.error, finishedAt: new Date().toISOString(), progress: 0 });
    try { if (fs.existsSync(compressedFile)) fs.unlinkSync(compressedFile); } catch (_) {}
    return;
  }

  const compressedSize = fs.existsSync(compressedFile) ? fs.statSync(compressedFile).size : 0;
  const ratio = result.rawBytes > 0 ? ((1 - compressedSize / result.rawBytes) * 100).toFixed(0) : '?';
  appendJobLog(jobId, `${ts()} ✅ Dump + compression complete — raw: ${(result.rawBytes / 1024 / 1024).toFixed(1)} MB → ${(compressedSize / 1024 / 1024).toFixed(1)} MB (${ratio}% saved)`);
  writeJob(jobId, { progress: 85, step: 'Verifying backup integrity' });

  // Step 4: Verify compressed output (gunzip integrity test)
  appendJobLog(jobId, `${ts()} 🔐 Verifying gzip integrity...`);
  const isValid = await new Promise<boolean>(resolve => {
    try {
      const rs = fs.createReadStream(compressedFile);
      const gunzip = zlib.createGunzip();
      rs.pipe(gunzip);
      gunzip.on('data', () => {});
      gunzip.on('end', () => resolve(true));
      gunzip.on('error', () => resolve(false));
      rs.on('error', () => resolve(false));
    } catch (_) { resolve(false); }
  });

  if (!isValid) {
    appendJobLog(jobId, `${ts()} ❌ ERROR: Compressed backup failed integrity check!`);
    writeJob(jobId, { status: 'failed', error: 'Compressed file integrity check failed', finishedAt: new Date().toISOString(), progress: 0 });
    return;
  }
  appendJobLog(jobId, `${ts()} ✅ Integrity verified`);
  writeJob(jobId, { progress: 93, step: 'Saving checksum' });

  // Step 5: Write SHA-256 (already computed on-the-fly — no second disk read needed)
  if (result.sha256) {
    fs.writeFileSync(compressedFile + '.sha256', `${result.sha256}  ${path.basename(compressedFile)}\n`);
    appendJobLog(jobId, `${ts()} 🔐 SHA-256: ${result.sha256.slice(0, 16)}...`);
  }

  // Step 6: Secondary Mirroring (if BACKUP_SECONDARY_DIR configured)
  writeJob(jobId, { progress: 95, step: 'Mirroring to secondary storage' });
  mirrorToSecondary(compressedFile, jobId);

  // Step 7: Automated Retention Pruning
  writeJob(jobId, { progress: 98, step: 'Applying retention policy' });
  const pruneResult = pruneOldBackups(dailyDir, jobId);
  if (pruneResult.prunedCount > 0) {
    appendJobLog(jobId, `${ts()} 🧹 Pruned ${pruneResult.prunedCount} old backup(s) older than ${process.env.BACKUP_RETENTION_DAYS || 14} days`);
  }

  // Step 8: Append to global backup log
  const duration = ((Date.now() - startTime.getTime()) / 1000).toFixed(1);
  try {
    const logLine = `[${new Date().toISOString()}] ✅ Backup complete (${duration}s) — ${path.basename(compressedFile)} (${(compressedSize / 1024 / 1024).toFixed(1)} MB)\n`;
    fs.appendFileSync(LOG_FILE, logLine);
  } catch (_) {}

  appendJobLog(jobId, `${ts()} 🎉 Backup complete in ${duration}s — ${path.basename(compressedFile)} (${(compressedSize / 1024 / 1024).toFixed(1)} MB)`);
  writeJob(jobId, {
    status: 'done',
    progress: 100,
    step: 'Complete',
    filename: path.basename(compressedFile),
    sizeFormatted: `${(compressedSize / 1024 / 1024).toFixed(1)} MB`,
    rawSizeFormatted: `${(result.rawBytes / 1024 / 1024).toFixed(1)} MB`,
    compressionRatio: `${ratio}%`,
    sha256: result.sha256,
    durationSeconds: parseFloat(duration),
    finishedAt: new Date().toISOString(),
  });
}

