import { NextResponse } from 'next/server';
import { sanitizeHtml } from '@/lib/security';
import { getSession } from '@/lib/auth';

// Module-scoped debug info (PoC only)
let lastUploadInfo: any = null;

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Accept multipart/form-data with a `file` field
    const form = await request.formData();
    const file = form.get('file') as Blob | null;
    const readingId = form.get('readingId')?.toString() || null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
    }

    // For PoC: don't persist to disk here. In production, stream/save to object storage.
    const rawFilename = (file as any)?.name || 'upload';
    const filename = sanitizeHtml(rawFilename);
    const size = (file as any)?.size || 0;

    // Save debug info about headers for tests
    lastUploadInfo = {
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: Date.now(),
      filename,
      size,
      readingId,
      userId: session.id,
    };

    return NextResponse.json({ success: true, filename, size, readingId });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session || !session.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Return last upload info for debugging/tests
  return NextResponse.json({ lastUploadInfo });
}

