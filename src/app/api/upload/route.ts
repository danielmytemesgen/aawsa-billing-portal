import { NextResponse } from 'next/server';
import { sanitizeHtml } from '@/lib/security';
import { getSession } from '@/lib/auth';

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

    // Sanitize filename for safe logging / response only — not persisted here
    const rawFilename = (file as any)?.name || 'upload';
    const filename = sanitizeHtml(rawFilename);
    const size = (file as any)?.size || 0;

    return NextResponse.json({ success: true, filename, size, readingId });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}

// NOTE: GET handler intentionally removed — it was a debug artifact that exposed
// internal request headers and user IDs via module-scoped state.
