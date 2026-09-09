import { NextRequest, NextResponse } from 'next/server';
import { createTicketAction, getAllTicketsAction, getCustomerTicketsAction } from '@/lib/support-actions';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerKey = searchParams.get('customerKey');
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const branchId = searchParams.get('branchId') || undefined;

    if (customerKey) {
      const res = await getCustomerTicketsAction(customerKey, { status });
      return NextResponse.json(res);
    }

    const res = await getAllTicketsAction({ status, priority, branchId });
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Server error' } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await createTicketAction(body);
    if (res.error) {
      return NextResponse.json(res, { status: 400 });
    }
    return NextResponse.json(res, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Server error' } }, { status: 500 });
  }
}
