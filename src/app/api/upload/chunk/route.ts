import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TMP_DIR = path.join(process.cwd(), 'uploads_tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const uploadId = url.searchParams.get('uploadId');
    const index = url.searchParams.get('index');
    if (!uploadId || index === null) return NextResponse.json({ success: false, message: 'uploadId and index required' }, { status: 400 });

    const buf = await request.arrayBuffer();
    const chunkPath = path.join(TMP_DIR, `${uploadId}.chunk.${index}`);
    fs.writeFileSync(chunkPath, Buffer.from(buf));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
