
// src/app/api/upload/pdf/route.ts
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed.' }, { status: 400 });
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit.' }, { status: 400 });
    }

    // For demonstration, we'll save the file to a temporary location
    // In a real application, you would upload to a cloud storage (e.g., S3)
    // or a persistent server directory and store its URL in the database.
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads'); // Save to public/uploads

    // Ensure the upload directory exists (in a real app, this might be handled by deployment setup)
    // For now, let's assume 'public/uploads' exists or will be created manually.
    // If running locally, you might need to create this folder.
    // For production, consider a dedicated storage service.

    // A more robust solution would ensure the directory exists:
    // await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const pdfUrl = `/uploads/${filename}`; // Publicly accessible URL

    return NextResponse.json({ pdfUrl });

  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json({ error: 'Failed to upload PDF.' }, { status: 500 });
  }
}
