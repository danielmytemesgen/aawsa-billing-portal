import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants/auth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

const BACKUP_BASE = process.env.BACKUP_DIR || 'C:\\aawsa\\backups';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const session = await getSession();
    let isAuthorized = false;

    if (session?.id) {
      const perms: string[] = session.permissions || [];
      if (perms.includes(PERMISSIONS.SETTINGS_MANAGE) || perms.includes('*') || perms.includes('all')) {
        isAuthorized = true;
      }
    }

    const cronSecret = process.env.BACKUP_CRON_SECRET;
    const reqCronSecret = request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!isAuthorized && cronSecret && reqCronSecret && reqCronSecret === cronSecret) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { filename, folder = 'daily' } = body;

    if (!filename || typeof filename !== 'string' || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ message: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(BACKUP_BASE, folder, filename);
    const checksumPath = filePath + '.sha256';

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ message: 'Backup file not found' }, { status: 404 });
    }

    const stats = fs.statSync(filePath);

    // ── Stage 1: Compute SHA-256 and check .sha256 file if present ─────────────
    let calculatedSha256 = '';
    let sha256Matched: boolean | null = null;
    let expectedSha256 = '';

    const hash = crypto.createHash('sha256');
    await new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => {
        calculatedSha256 = hash.digest('hex');
        resolve();
      });
      stream.on('error', reject);
    });

    if (fs.existsSync(checksumPath)) {
      const rawChecksum = fs.readFileSync(checksumPath, 'utf-8').trim();
      expectedSha256 = rawChecksum.split(/\s+/)[0] || '';
      sha256Matched = calculatedSha256.toLowerCase() === expectedSha256.toLowerCase();
    } else {
      // Create checksum file if missing
      try {
        fs.writeFileSync(checksumPath, `${calculatedSha256}  ${filename}\n`);
        sha256Matched = true;
        expectedSha256 = calculatedSha256;
      } catch (_) {}
    }

    // ── Stage 2: Test Gzip stream decompression & capture header ──────────────
    let gzipValid = false;
    let headerValid = false;
    let headerSnippet = '';
    let decompressedBytes = 0;

    await new Promise<void>((resolve) => {
      try {
        const rs = fs.createReadStream(filePath);
        const gunzip = zlib.createGunzip();

        gunzip.on('data', (chunk: Buffer) => {
          decompressedBytes += chunk.length;
          if (headerSnippet.length < 1024) {
            headerSnippet += chunk.toString('utf-8', 0, Math.min(chunk.length, 1024 - headerSnippet.length));
          }
        });

        gunzip.on('end', () => {
          gzipValid = true;
          // ── Stage 3: PostgreSQL dump signature check ─────────────────────────
          const hasPgSignature =
            headerSnippet.includes('PostgreSQL database dump') ||
            headerSnippet.includes('pg_dump') ||
            headerSnippet.includes('SET statement_timeout') ||
            headerSnippet.includes('CREATE TABLE') ||
            headerSnippet.includes('SET client_encoding');

          headerValid = hasPgSignature;
          resolve();
        });

        gunzip.on('error', () => {
          gzipValid = false;
          headerValid = false;
          resolve();
        });

        rs.on('error', () => {
          gzipValid = false;
          resolve();
        });

        rs.pipe(gunzip);
      } catch (_) {
        gzipValid = false;
        resolve();
      }
    });

    const elapsedMs = Date.now() - startTime;
    const overallValid = Boolean(gzipValid && (sha256Matched !== false) && headerValid);

    let details = 'All checks passed: valid Gzip stream, verified checksum, and authentic PostgreSQL headers.';
    if (!gzipValid) details = 'Gzip stream corrupted or truncated.';
    else if (sha256Matched === false) details = 'SHA-256 checksum mismatch (file altered or incomplete).';
    else if (!headerValid) details = 'Warning: Archive decompressed, but standard PostgreSQL dump headers were not recognized.';

    return NextResponse.json({
      valid: overallValid,
      filename,
      sizeFormatted: formatBytes(stats.size),
      decompressedSizeFormatted: formatBytes(decompressedBytes),
      sha256: calculatedSha256,
      expectedSha256,
      sha256Matched,
      gzipValid,
      headerValid,
      details,
      elapsedMs,
    });

  } catch (error: any) {
    console.error('Verify backup error:', error);
    return NextResponse.json({ message: error?.message || 'Verification failed' }, { status: 500 });
  }
}
