import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Only authenticated staff can upload files
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Basic validation
    if (file.size > 5 * 1024 * 1024) { // 5MB
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const fileName = `${uuidv4()}-${file.name.replace(/\s+/g, '_')}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'pdf');
    const filePath = join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    const pdfUrl = `/uploads/pdf/${fileName}`;

    return NextResponse.json({ pdfUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error during upload' }, { status: 500 });
  }
}
