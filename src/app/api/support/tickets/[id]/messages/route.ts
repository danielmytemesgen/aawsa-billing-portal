import { NextRequest, NextResponse } from 'next/server';
import { addMessageAction, getTicketDetailAction } from '@/lib/support-actions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await getTicketDetailAction(id);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Server error' } }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const res = await addMessageAction({
      ...body,
      ticketId: id,
    });
    if (res.error) {
      return NextResponse.json(res, { status: 400 });
    }
    return NextResponse.json(res, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Server error' } }, { status: 500 });
  }
}
