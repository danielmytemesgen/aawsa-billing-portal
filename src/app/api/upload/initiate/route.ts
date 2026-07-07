import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';

const TMP_DIR = path.join(process.cwd(), 'uploads_tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

export async function POST(request: Request) {
  try {
    // Authentication check - user must be authenticated
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const filename = body.filename ? String(body.filename).slice(0, 255) : 'file.bin';
    const totalChunks = body.totalChunks ? Number(body.totalChunks) : 1;

    const uploadId = randomUUID();
    // create a marker file with metadata
    const meta = { filename, totalChunks, createdAt: new Date().toISOString() };
    fs.writeFileSync(path.join(TMP_DIR, `${uploadId}.meta.json`), JSON.stringify(meta));

    return NextResponse.json({ success: true, uploadId });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
