import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';

const TMP_DIR = path.join(process.cwd(), 'uploads_tmp');
const OUT_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

export async function POST(request: Request) {
  try {
    // Authentication check - user must be authenticated
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const uploadId = body.uploadId;
    if (!uploadId) return NextResponse.json({ success: false, message: 'uploadId required' }, { status: 400 });

    const metaPath = path.join(TMP_DIR, `${uploadId}.meta.json`);
    if (!fs.existsSync(metaPath)) return NextResponse.json({ success: false, message: 'upload not found' }, { status: 404 });
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const parts: Buffer[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      const chunkPath = path.join(TMP_DIR, `${uploadId}.chunk.${i}`);
      if (!fs.existsSync(chunkPath)) return NextResponse.json({ success: false, message: `missing chunk ${i}` }, { status: 400 });
      parts.push(fs.readFileSync(chunkPath));
    }

    const filenameSafe = meta.filename.replace(/[^a-zA-Z0-9\.\-_]/g, '_');
    const outName = `${uploadId}_${filenameSafe}`;
    const outPath = path.join(OUT_DIR, outName);
    fs.writeFileSync(outPath, Buffer.concat(parts));

    // cleanup
    fs.unlinkSync(metaPath);
    for (let i = 0; i < meta.totalChunks; i++) {
      const chunkPath = path.join(TMP_DIR, `${uploadId}.chunk.${i}`);
      try { fs.unlinkSync(chunkPath); } catch (e) { /* ignore */ }
    }

    return NextResponse.json({ success: true, url: `/uploads/${outName}` });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
