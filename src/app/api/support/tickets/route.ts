import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { decrypt } from '@/lib/auth';
import { createTicketAction, getAllTicketsAction, getCustomerTicketsAction } from '@/lib/support-actions';

/**
 * GET /api/support/tickets
 *
 * Security: Requires either a valid staff session OR a valid customer session
 * cookie. Unauthenticated requests are rejected with 401.
 */
export async function GET(req: NextRequest) {
  // Auth guard: must have staff session OR customer session cookie
  const staffSession = await getSession();
  let customerSession: any = null;

  if (!staffSession?.id) {
    // Try customer cookie
    const customerCookie = req.cookies.get('customer_session')?.value;
    if (customerCookie) {
      try {
        customerSession = await decrypt(customerCookie);
      } catch {
        customerSession = null;
      }
    }

    if (!customerSession?.customerKeyNumber) {
      return NextResponse.json(
        { error: { message: 'Unauthorized: Authentication required', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
  }

  try {
    const { searchParams } = new URL(req.url);
    const customerKey = searchParams.get('customerKey');
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const branchId = searchParams.get('branchId') || undefined;

    if (customerKey) {
      // Customer session: restrict to their own key only
      if (customerSession && customerSession.customerKeyNumber !== customerKey) {
        return NextResponse.json(
          { error: { message: 'Forbidden: Cannot access tickets for another customer', code: 'FORBIDDEN' } },
          { status: 403 }
        );
      }
      const res = await getCustomerTicketsAction(customerKey, { status });
      return NextResponse.json(res);
    }

    // Staff-only: list all tickets (getAllTicketsAction enforces its own permission check)
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
