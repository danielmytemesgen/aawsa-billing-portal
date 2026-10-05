import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkAawsaPaidStatus, UploaderCheckRequest } from '@/lib/aawsa-uploader-client';
import { dbSyncCustomerPaymentAndReading } from '@/lib/db-queries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/sync-payment-status
 * 
 * Interacts with the AAWSA port 5001 uploader endpoint (internal: 10.10.254.155:5001, external: bill.aawsa.gov.et:5001)
 * to verify and update PAYMENT STATUS and RECONCILIATION ONLY.
 * Reading updates are strictly excluded from this endpoint.
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate request: check staff session or internal API key
    const internalKey = request.headers.get('x-internal-key');
    const session = await getSession();

    const isInternalAuthorized = internalKey && internalKey === (process.env.INTERNAL_API_KEY || 'd52e2cc3ace3a52a189ed2607f311da6');
    const isStaffAuthorized = session && session.id;

    if (!isInternalAuthorized && !isStaffAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Valid staff session or x-internal-key header required.' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      customerKey,
      contractNo,
      payrollNumber,
      password,
      networkMode,
      dryRun,
    } = body;

    if (!customerKey && !contractNo) {
      return NextResponse.json(
        { success: false, error: 'Either customerKey or contractNo must be provided.' },
        { status: 400 }
      );
    }

    // 3. Query AAWSA 5001 uploader endpoint
    const checkParams: UploaderCheckRequest = {
      customerKey,
      contractNo,
      payrollNumber,
      password,
      networkMode: networkMode || 'auto',
    };

    const endpointResult = await checkAawsaPaidStatus(checkParams);

    if (!endpointResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: endpointResult.error || 'Failed to check status from AAWSA endpoint',
          networkUsed: endpointResult.networkUsed,
          endpointUsed: endpointResult.endpointUsed,
          rawResponse: endpointResult.rawResponse,
        },
        { status: 422 }
      );
    }

    // 4. Update Database if not a dry-run (PAYMENT STATUS & RECONCILIATION ONLY)
    let dbSyncResult = null;
    if (!dryRun) {
      dbSyncResult = await dbSyncCustomerPaymentAndReading({
        customerKey: customerKey || endpointResult.rawResponse?.customer_key,
        contractNo: contractNo || endpointResult.rawResponse?.contract_no,
        customerName: endpointResult.customerName,
        branch: endpointResult.branch,
        billKey: endpointResult.billKey,
        paymentStatus: endpointResult.paymentStatus,
        amountPaid: endpointResult.amountPaid ?? endpointResult.totalBillAmount,
        paymentDate: endpointResult.paymentDate,
        paymentChannel: endpointResult.paymentChannel,
        bankRef: endpointResult.bankRef || endpointResult.billKey,
        reconciliationStatus: 'Reconciled',
        staffId: session?.id || null,
        syncSource: `AAWSA_UPLOADER_${endpointResult.networkUsed.toUpperCase()}`,
      });
    }

    return NextResponse.json({
      success: true,
      networkUsed: endpointResult.networkUsed,
      endpointUsed: endpointResult.endpointUsed,
      data: {
        isPaid: endpointResult.isPaid,
        paymentStatus: endpointResult.paymentStatus,
        amountPaid: endpointResult.amountPaid,
        paymentDate: endpointResult.paymentDate,
        bankRef: endpointResult.bankRef,
        paymentChannel: endpointResult.paymentChannel,
        reconciliationStatus: 'Reconciled',
      },
      dbSync: dbSyncResult,
      rawResponse: endpointResult.rawResponse,
    });
  } catch (error: any) {
    console.error('[API /api/billing/sync-payment-status] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error occurred during payment sync.' },
      { status: 500 }
    );
  }
}
