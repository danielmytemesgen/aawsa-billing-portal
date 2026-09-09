import { describe, it, expect, vi } from 'vitest';
import { dbGetPaymentById, dbCreatePayment } from '../db-queries';

describe('Billing Audit Fixes - Payments & Aging Sync', () => {
  it('dbGetPaymentById queries payment by ID using client query when passed', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'pay-123', amount_paid: 500, bill_id: 'bill-abc' }]
      })
    };

    const payment = await dbGetPaymentById('pay-123', mockClient);

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM payments WHERE id = $1 AND deleted_at IS NULL',
      ['pay-123']
    );
    expect(payment).toEqual({ id: 'pay-123', amount_paid: 500, bill_id: 'bill-abc' });
  });

  it('dbGetPaymentById returns null if payment not found', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    };

    const payment = await dbGetPaymentById('pay-999', mockClient);
    expect(payment).toBeNull();
  });

  it('dbCreatePayment utilizes transactional client when provided', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'pay-new-1', amount_paid: 1200, payment_method: 'Bank Transfer' }]
      })
    };

    const newPayment = {
      amount_paid: 1200,
      payment_method: 'cbe',
      bill_id: 'bill-xyz'
    };

    const result = await dbCreatePayment(newPayment, mockClient);

    expect(mockClient.query).toHaveBeenCalled();
    const querySql = mockClient.query.mock.calls[0][0];
    expect(querySql).toContain('INSERT INTO payments');
    expect(result.id).toBe('pay-new-1');
    expect(newPayment.payment_method).toBe('Bank Transfer');
  });
});
