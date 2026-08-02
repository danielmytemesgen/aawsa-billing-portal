import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  // Authentication check - user must be authenticated
  const session = await getSession();
  if (!session || !session.id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Placeholder: return 501 unless S3 is configured. Implement S3 presign when needed.
  if (!process.env.AWS_S3_BUCKET) {
    return NextResponse.json({ success: false, message: 'S3 not configured' }, { status: 501 });
  }

  // TODO: implement presign using @aws-sdk/s3-request-presigner when dependency is available
  return NextResponse.json({ success: false, message: 'Not implemented' }, { status: 501 });
}
