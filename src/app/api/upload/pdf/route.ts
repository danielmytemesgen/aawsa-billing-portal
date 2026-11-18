import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { checkPermissionAny } from '@/lib/actions';
import { PERMISSIONS } from '@/lib/constants/auth';

export async function POST(request: NextRequest) {
  try {
    // Only staff with knowledge-base manage, settings manage, or bill view all permissions can upload PDFs
    const session = await checkPermissionAny(
      PERMISSIONS.KNOWLEDGE_BASE_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.BILL_VIEW_ALL
    );
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

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate safe unique filename, preventing directory traversal
    const safeBaseName = basename(file.name || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${uuidv4()}-${safeBaseName}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'pdf');
    
    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, fileName);

    if (!filePath.startsWith(uploadDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    await writeFile(filePath, buffer);

    const pdfUrl = `/uploads/pdf/${fileName}`;

    return NextResponse.json({ pdfUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error during upload' }, { status: 500 });
  }
}
