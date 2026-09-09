import { NextRequest, NextResponse } from 'next/server';
import { updateTicketStatusAction } from '@/lib/support-actions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const res = await updateTicketStatusAction(id, body.status);
    if (res.error) {
      return NextResponse.json(res, { status: 400 });
    }
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Server error' } }, { status: 500 });
  }
}
