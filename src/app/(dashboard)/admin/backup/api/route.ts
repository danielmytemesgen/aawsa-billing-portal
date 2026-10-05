import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants/auth';
import fs from 'fs';
import path from 'path';

const BACKUP_BASE = process.env.BACKUP_DIR || 'C:\\aawsa\\backups';
const LOG_FILE = process.env.BACKUP_LOG_FILE || 'C:\\aawsa\\backup.log';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'list';
    const folder = searchParams.get('folder') || 'daily';

    if (view === 'log') {
      // Return last 200 lines of the backup log
      if (!fs.existsSync(LOG_FILE)) {
        return NextResponse.json({ lines: ['Log file not found: ' + LOG_FILE] });
      }
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const lines = content.split('\n').filter(Boolean).slice(-200);
      return NextResponse.json({ lines });
    }

    if (view === 'list') {
      const dir = path.join(BACKUP_BASE, folder);
      if (!fs.existsSync(dir)) {
        return NextResponse.json({ files: [] });
      }

      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.sql.gz') || f.endsWith('.zip'))
        .map(filename => {
          const filePath = path.join(dir, filename);
          const stats = fs.statSync(filePath);
          const checksumFile = filePath + '.sha256';
          const hasChecksum = fs.existsSync(checksumFile);
          return {
            name: filename,
            folder,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            date: stats.mtime.toISOString(),
            hasChecksum,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return NextResponse.json({ files });
    }

    if (view === 'stats') {
      const dailyDir = path.join(BACKUP_BASE, 'daily');
      const monthlyDir = path.join(BACKUP_BASE, 'monthly');

      const dailyFiles = fs.existsSync(dailyDir)
        ? fs.readdirSync(dailyDir).filter(f => f.endsWith('.sql.gz') || f.endsWith('.zip'))
        : [];
      const monthlyFiles = fs.existsSync(monthlyDir)
        ? fs.readdirSync(monthlyDir).filter(f => f.endsWith('.sql.gz') || f.endsWith('.zip'))
        : [];

      let lastBackup = null;
      let lastBackupSize = 0;
      if (dailyFiles.length > 0) {
        const latestFile = dailyFiles
          .map(f => ({ name: f, mtime: fs.statSync(path.join(dailyDir, f)).mtime }))
          .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
        lastBackup = latestFile.mtime.toISOString();
        lastBackupSize = fs.statSync(path.join(dailyDir, latestFile.name)).size;
      }

      return NextResponse.json({
        dailyCount: dailyFiles.length,
        monthlyCount: monthlyFiles.length,
        lastBackup,
        lastBackupSizeFormatted: formatBytes(lastBackupSize),
        backupDir: BACKUP_BASE,
      });
    }

    return NextResponse.json({ message: 'Unknown view' }, { status: 400 });
  } catch (error) {
    console.error('Backup API error:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const perms: string[] = session.permissions || [];
    if (!perms.includes(PERMISSIONS.SETTINGS_MANAGE) && !perms.includes('*')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { filename, folder } = await request.json();
    if (!filename || typeof filename !== 'string' || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ message: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(BACKUP_BASE, folder || 'daily', filename);
    const checksumPath = filePath + '.sha256';

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }

    fs.unlinkSync(filePath);
    if (fs.existsSync(checksumPath)) fs.unlinkSync(checksumPath);

    return NextResponse.json({ success: true, message: `Deleted ${filename}` });
  } catch (error) {
    console.error('Delete backup error:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
