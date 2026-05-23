import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Accept multipart/form-data with a `file` field
    const form = await request.formData();
    const file = form.get('file') as Blob | null;
    const readingId = form.get('readingId')?.toString() || null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
    }

    // For PoC: don't persist to disk here. In production, stream/save to object storage.
    const filename = (file as any)?.name || 'upload';
    const size = (file as any)?.size || 0;

    // You may implement storing the file to disk or cloud storage here.

    return NextResponse.json({ success: true, filename, size, readingId });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
