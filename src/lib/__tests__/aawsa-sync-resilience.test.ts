import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAawsaPaidStatus } from '../aawsa-uploader-client';

describe('AAWSA Sync Resilience & Circuit Breaker', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('detects missing target customer identifier and returns error immediately without network call', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await checkAawsaPaidStatus({
      payrollNumber: 'AAWSA-TEST',
      password: 'password123',
      batchMode: true,
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Either Customer Key or Contract Number must be provided/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handles simulated server response accurately', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        success: true,
        confirmed: true,
        paid: true,
        paid_label: 'Paid',
        current_invoice: {
          curr_read: 1540,
          prev_read: 1420,
          consumption: 120,
          period: '2026-08',
          this_month: 4500,
          outstanding: 0,
          total: 4500,
        },
        paid_status: {
          paid: true,
          status: 'Paid',
          channel: 'CBE',
          bill_key: 'BBPT-998877',
        },
      }),
    });

    const res = await checkAawsaPaidStatus({
      customerKey: 'BM-12345678',
      batchMode: true,
    });

    expect(res.success).toBe(true);
    expect(res.isPaid).toBe(true);
    expect(res.paymentStatus).toBe('Paid');
    expect(res.currentReading).toBe(1540);
    expect(res.previousReading).toBe(1420);
    expect(res.consumption).toBe(120);
    expect(res.paymentChannel).toBe('CBE');
    expect(res.billKey).toBe('BBPT-998877');
  });

  it('recognizes timeout patterns correctly', () => {
    const TIMEOUT_PATTERNS = ['timed out', 'ECONNREFUSED', 'ENOTFOUND', 'Could not reach AAWSA endpoint', 'fetch failed'];
    function isTimeoutError(msg?: string): boolean {
      if (!msg) return false;
      const lower = msg.toLowerCase();
      return TIMEOUT_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
    }

    expect(isTimeoutError('Request timed out after 1500ms')).toBe(true);
    expect(isTimeoutError('connect ECONNREFUSED 10.10.254.155:5001')).toBe(true);
    expect(isTimeoutError('getaddrinfo ENOTFOUND bill.aawsa.gov.et')).toBe(true);
    expect(isTimeoutError('Could not reach AAWSA endpoint: network down')).toBe(true);
    expect(isTimeoutError('TypeError: fetch failed')).toBe(true);
    expect(isTimeoutError('Invalid customer key format')).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });

  it('simulates circuit breaker tripping after threshold consecutive errors', () => {
    const CIRCUIT_BREAKER_THRESHOLD = 5;
    let consecutiveTimeouts = 0;
    let circuitOpen = false;

    const mockErrors = [
      'timed out',
      'timed out',
      'timed out',
      'timed out',
      'timed out',
      'another error',
    ];

    const results: string[] = [];

    for (const err of mockErrors) {
      if (circuitOpen) {
        results.push('Skipped by circuit breaker');
        continue;
      }
      consecutiveTimeouts++;
      if (consecutiveTimeouts >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitOpen = true;
      }
      results.push('Processed with error');
    }

    expect(circuitOpen).toBe(true);
    expect(consecutiveTimeouts).toBe(5);
    expect(results).toEqual([
      'Processed with error',
      'Processed with error',
      'Processed with error',
      'Processed with error',
      'Processed with error',
      'Skipped by circuit breaker',
    ]);
  });
});
