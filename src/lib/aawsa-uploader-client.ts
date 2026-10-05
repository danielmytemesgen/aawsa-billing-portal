/**
 * AAWSA Uploader & Central Payment Service Client
 *
 * Communicates with the AAWSA port 5001 service:
 * - Internal: http://10.10.254.155:5001/api/uploader/paid-status
 * - External: http://bill.aawsa.gov.et:5001/api/uploader/paid-status
 *
 * Real API response structure (confirmed from live test with BM-50557125):
 * {
 *   success: true, confirmed: true, paid: true, paid_label: "Paid",
 *   auth:           { payroll_number, username, role, branch },
 *   customer:       { customer_key, customer_name, contract_number, address, branch, phone },
 *   current_invoice:{ customer_key, bill_key, curr_read, prev_read, consumption, period,
 *                     this_month, outstanding, total, vat_amount, ... },
 *   latest_bill:    { bill_key, curr_read, prev_read, consumption, period, this_month, ... },
 *   paid_status:    { paid, status, bill_key, channel, payment_amount, payment_date,
 *                     outstanding, bill_amount, deposited, reconciled, source, period },
 *   summary:        { bill_count, paid_count, unpaid_count, current_count, past_count,
 *                     paid_total, outstanding_total }
 * }
 */

export interface UploaderCheckRequest {
  payrollNumber?: string;
  password?: string;
  customerKey?: string;
  contractNo?: string;
  networkMode?: 'auto' | 'internal' | 'external';
  /**
   * Set to true when calling from batch sync.
   * Uses a shorter timeout (1500ms) and only 1 retry per endpoint
   * so the circuit breaker trips quickly when AAWSA is down.
   */
  batchMode?: boolean;
}

export interface UploaderCheckResult {
  success: boolean;
  isPaid: boolean;
  /** Normalised to 'Paid' | 'Unpaid' */
  paymentStatus: 'Paid' | 'Unpaid' | string;
  currentReading: number | null;
  previousReading: number | null;
  /** m³ consumed this billing period */
  consumption: number | null;
  /** Billing period label, e.g. "Aug-26" */
  billedPeriod: string | null;
  /** This-month bill amount (before adding outstanding) */
  thisMonthAmount: number | null;
  /** Outstanding balance remaining after payment */
  outstandingAmount: number | null;
  /** Total payable (this_month + outstanding) */
  totalBillAmount: number | null;
  /** Amount actually paid */
  amountPaid: number | null;
  paymentDate: string | null;
  /** Payment channel as returned by API, e.g. "CBE", "telebirr" */
  paymentChannel: string | null;
  /** Bill key / receipt reference, e.g. "BBPT-3546334076" */
  bankRef: string | null;
  billKey: string | null;
  customerName: string | null;
  branch: string | null;
  /** customer_key returned by the API (may differ in casing from what was sent) */
  customerKeyFromApi: string | null;
  contractNo: string | null;
  confirmed: boolean;
  deposited: boolean;
  reconciled: boolean;
  endpointUsed: string;
  networkUsed: 'internal' | 'external';
  rawResponse?: any;
  error?: string;
}

import { normalizeBillingPeriod } from './period-utils';

const DEFAULT_INTERNAL_URL = process.env.AAWSA_INTERNAL_API_URL || 'http://10.10.254.155:5001';
const DEFAULT_EXTERNAL_URL = process.env.AAWSA_EXTERNAL_API_URL || 'http://bill.aawsa.gov.et:5001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function emptyResult(
  overrides: Partial<UploaderCheckResult>
): UploaderCheckResult {
  return {
    success: false,
    isPaid: false,
    paymentStatus: 'Unpaid',
    currentReading: null,
    previousReading: null,
    consumption: null,
    billedPeriod: null,
    thisMonthAmount: null,
    outstandingAmount: null,
    totalBillAmount: null,
    amountPaid: null,
    paymentDate: null,
    paymentChannel: null,
    bankRef: null,
    billKey: null,
    customerName: null,
    branch: null,
    customerKeyFromApi: null,
    contractNo: null,
    confirmed: false,
    deposited: false,
    reconciled: false,
    endpointUsed: '',
    networkUsed: 'internal',
    ...overrides,
  };
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 600
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries) throw err;
      const backoff = delayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

// ─── HTTP call ────────────────────────────────────────────────────────────────

async function callPaidStatusEndpoint(
  baseUrl: string,
  payload: {
    payroll_number: string;
    password: string;
    customer_key?: string;
    contract_no?: string;
  },
  timeoutMs = 7000
): Promise<any> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/uploader/paid-status`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        _httpOk: false,
        status: response.status,
        error: json?.error || json?.message || `HTTP ${response.status}`,
        json,
      };
    }

    return { _httpOk: true, status: response.status, json };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms connecting to ${url}`);
    }
    throw err;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Check payment status and fetch customer reading from the AAWSA 5001 uploader endpoint.
 * Handles auto-detection / fallback between internal and external networks.
 */
export async function checkAawsaPaidStatus(
  params: UploaderCheckRequest
): Promise<UploaderCheckResult> {
  const payroll = (params.payrollNumber || process.env.AAWSA_UPLOADER_PAYROLL || 'C00757U').trim();
  const password = (params.password || process.env.AAWSA_UPLOADER_PASSWORD || 'AAWSA1234').trim();
  const customerKey = (params.customerKey || '').trim();
  const contractNo = (params.contractNo || '').trim();

  if (!payroll || !password) {
    return emptyResult({
      error:
        'Staff payroll number and password are required to authenticate with the AAWSA uploader endpoint.',
    });
  }

  if (!customerKey && !contractNo) {
    return emptyResult({ error: 'Either Customer Key or Contract Number must be provided.' });
  }

  const payload: {
    payroll_number: string;
    password: string;
    customer_key?: string;
    contract_no?: string;
  } = { payroll_number: payroll, password };
  if (customerKey) payload.customer_key = customerKey;
  if (contractNo) payload.contract_no = contractNo;

  const mode =
    params.networkMode ||
    (process.env.AAWSA_NETWORK_MODE as 'auto' | 'internal' | 'external') ||
    'auto';

  const candidateUrls: Array<{ type: 'internal' | 'external'; url: string }> = [];
  if (mode === 'internal') {
    candidateUrls.push({ type: 'internal', url: DEFAULT_INTERNAL_URL });
  } else if (mode === 'external') {
    candidateUrls.push({ type: 'external', url: DEFAULT_EXTERNAL_URL });
  } else {
    // In 'auto' mode: try internal first (direct LAN path), then external as fallback
    candidateUrls.push({ type: 'internal', url: DEFAULT_INTERNAL_URL });
    if (DEFAULT_EXTERNAL_URL !== DEFAULT_INTERNAL_URL && !DEFAULT_EXTERNAL_URL.includes('10.10.254.155')) {
      candidateUrls.push({ type: 'external', url: DEFAULT_EXTERNAL_URL });
    }
  }

  let lastError = '';
  let successfulRes: any = null;
  let successfulTarget: { type: 'internal' | 'external'; url: string } | null = null;

  // The AAWSA centralized billing service takes ~15-25 seconds to compute live customer status
  const defaultTimeout = Number(process.env.AAWSA_API_TIMEOUT_MS) || 35000;
  const timeoutMs = params.batchMode
    ? (Number(process.env.AAWSA_BATCH_TIMEOUT_MS) || defaultTimeout)
    : defaultTimeout;
  const maxRetries = params.batchMode ? 1 : 2;

  for (const candidate of candidateUrls) {
    try {
      const res = await withRetry(
        () =>
          callPaidStatusEndpoint(
            candidate.url,
            payload,
            timeoutMs
          ),
        maxRetries,
        600
      );

      if (!res._httpOk) {
        // The service responded but with a business-level error (e.g. invalid credentials)
        return emptyResult({
          endpointUsed: `${candidate.url}/api/uploader/paid-status`,
          networkUsed: candidate.type,
          error: res.error || 'Endpoint returned an error',
          rawResponse: res.json,
        });
      }

      successfulRes = res.json;
      successfulTarget = candidate;
      break;
    } catch (err: any) {
      lastError = err.message || String(err);
      console.warn(
        `[AAWSA Uploader] Failed to reach ${candidate.type} (${candidate.url}): ${lastError}`
      );
    }
  }

  if (!successfulRes || !successfulTarget) {
    return emptyResult({
      endpointUsed: candidateUrls.map((c) => c.url).join(', '),
      networkUsed: candidateUrls[0]?.type || 'internal',
      error: `Could not reach AAWSA endpoint: ${lastError}`,
    });
  }

  const d = successfulRes;

  // ── Readings ────────────────────────────────────────────────────────────────
  const currentReading =
    toNum(d.current_invoice?.curr_read) ??
    toNum(d.latest_bill?.curr_read) ??
    toNum(d.current_reading) ??
    toNum(d.currentReading) ??
    toNum(d.meter_reading) ??
    toNum(d.currRead) ??
    null;

  const previousReading =
    toNum(d.current_invoice?.prev_read) ??
    toNum(d.latest_bill?.prev_read) ??
    toNum(d.previous_reading) ??
    toNum(d.previousReading) ??
    toNum(d.prevRead) ??
    null;

  const consumption =
    toNum(d.current_invoice?.consumption) ??
    toNum(d.latest_bill?.consumption) ??
    toNum(d.consumption) ??
    null;

  // ── Period ──────────────────────────────────────────────────────────────────
  const rawPeriod =
    d.current_invoice?.period ||
    d.latest_bill?.period ||
    d.paid_status?.period ||
    d.period ||
    null;
  const billedPeriod = rawPeriod ? normalizeBillingPeriod(rawPeriod) : null;

  // ── Payment status ──────────────────────────────────────────────────────────
  // paid_status.status comes as lowercase "paid" from the real API → normalise
  const isPaid = Boolean(
    d.paid === true ||
      d.is_paid === true ||
      d.isPaid === true ||
      d.paid_status?.paid === true ||
      String(d.paid_label || '').trim().toLowerCase() === 'paid' ||
      String(d.paid_status?.status || '').trim().toLowerCase() === 'paid' ||
      String(d.payment_status || d.paymentStatus || '')
        .trim()
        .toLowerCase() === 'paid' ||
      (d.confirmed === true &&
        String(d.status || '').trim().toLowerCase() === 'paid')
  );
  const paymentStatus: 'Paid' | 'Unpaid' = isPaid ? 'Paid' : 'Unpaid';

  // ── Financial ───────────────────────────────────────────────────────────────
  const amountPaid =
    toNum(d.paid_status?.payment_amount) ??
    toNum(d.paid_status?.bill_amount) ??
    toNum(d.amount_paid) ??
    toNum(d.amountPaid) ??
    null;

  const thisMonthAmount =
    toNum(d.current_invoice?.this_month) ??
    toNum(d.latest_bill?.this_month) ??
    null;

  const outstandingAmount =
    toNum(d.paid_status?.outstanding) ??
    toNum(d.current_invoice?.outstanding) ??
    toNum(d.latest_bill?.outstanding) ??
    toNum(d.summary?.outstanding_total) ??
    null;

  const totalBillAmount =
    toNum(d.current_invoice?.total) ??
    toNum(d.latest_bill?.total) ??
    toNum(d.paid_status?.bill_amount) ??
    toNum(d.total_bill_amount) ??
    null;

  // ── Payment metadata ────────────────────────────────────────────────────────
  // ISO date: "2026-09-08T16:46:41"
  const paymentDate =
    d.paid_status?.payment_date ||
    d.payment_date ||
    d.paymentDate ||
    d.last_payment_date ||
    (isPaid ? new Date().toISOString() : null);

  // Exact channel as returned by API (e.g. "CBE", "telebirr", "CBE Birr") — exact string
  const rawChannelValue =
    d.paid_status?.channel ||
    d.paid_status?.payment_channel ||
    d.paid_status?.paymentChannel ||
    d.paid_status?.payment_method ||
    d.payment_channel ||
    d.paymentChannel ||
    d.payment_method ||
    d.paymentMethod ||
    d.channel ||
    null;
  const paymentChannel = rawChannelValue ? String(rawChannelValue).trim() : null;

  // Bill key e.g. "BBPT-3546334076"
  const billKey =
    d.paid_status?.bill_key ||
    d.current_invoice?.bill_key ||
    d.latest_bill?.bill_key ||
    d.bill_key ||
    null;

  const bankRef =
    billKey ||
    d.bank_ref ||
    d.bankRef ||
    d.receipt_no ||
    d.transaction_id ||
    d.reference ||
    null;

  // ── Customer info ───────────────────────────────────────────────────────────
  const customerName =
    d.customer?.customer_name ||
    d.current_invoice?.customer_name ||
    d.customer_name ||
    null;

  const customerKeyFromApi =
    d.customer?.customer_key ||
    d.current_invoice?.customer_key ||
    d.customer_key ||
    customerKey ||
    null;

  const contractNoFromApi =
    (d.customer?.contract_number !== '' ? d.customer?.contract_number : null) ||
    (d.current_invoice?.contract_number !== ''
      ? d.current_invoice?.contract_number
      : null) ||
    d.contract_number ||
    contractNo ||
    null;

  const branch =
    d.customer?.branch ||
    d.current_invoice?.branch ||
    d.auth?.branch ||
    d.branch ||
    null;

  const confirmed = Boolean(d.confirmed || isPaid);
  const deposited = Boolean(d.paid_status?.deposited ?? isPaid);
  const reconciled = Boolean(d.paid_status?.reconciled ?? isPaid);

  return {
    success: true,
    isPaid,
    paymentStatus,
    currentReading,
    previousReading,
    consumption,
    billedPeriod,
    thisMonthAmount,
    outstandingAmount,
    totalBillAmount,
    amountPaid,
    paymentDate,
    paymentChannel,
    bankRef,
    billKey,
    customerName,
    branch,
    customerKeyFromApi,
    contractNo: contractNoFromApi,
    confirmed,
    deposited,
    reconciled,
    endpointUsed: `${successfulTarget.url}/api/uploader/paid-status`,
    networkUsed: successfulTarget.type,
    rawResponse: d,
  };
}
