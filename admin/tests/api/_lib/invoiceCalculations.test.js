import { describe, it, expect } from 'vitest';
import {
  calculateLineItemPence,
  calculateInvoiceTotals,
  validateNewPaymentAmount,
  derivePaymentStatus,
  isOverdue,
} from '../../../api/_lib/invoiceCalculations.js';

describe('calculateLineItemPence', () => {
  it('computes quantity × unitPrice − lineDiscount', () => {
    const result = calculateLineItemPence({ quantity: 3, unitPrice: 25.5, lineDiscount: 5 });
    expect(result).toEqual({ ok: true, linePence: 7150 }); // (3*2550) - 500
  });

  it('rejects zero or negative quantity', () => {
    expect(calculateLineItemPence({ quantity: 0, unitPrice: 10 }).ok).toBe(false);
    expect(calculateLineItemPence({ quantity: -1, unitPrice: 10 }).ok).toBe(false);
  });

  it('rejects NaN/Infinity anywhere', () => {
    expect(calculateLineItemPence({ quantity: NaN, unitPrice: 10 }).ok).toBe(false);
    expect(calculateLineItemPence({ quantity: 1, unitPrice: Infinity }).ok).toBe(false);
    expect(calculateLineItemPence({ quantity: 1, unitPrice: 10, lineDiscount: NaN }).ok).toBe(false);
  });

  it('rejects a line discount larger than the line subtotal', () => {
    const result = calculateLineItemPence({ quantity: 1, unitPrice: 10, lineDiscount: 20 });
    expect(result).toEqual({ ok: false, error: 'lineDiscount cannot exceed quantity × unitPrice' });
  });

  it('rejects negative unitPrice', () => {
    expect(calculateLineItemPence({ quantity: 1, unitPrice: -5 }).ok).toBe(false);
  });

  it('handles decimal pence correctly without float drift (0.1 + 0.2 class of bug)', () => {
    const result = calculateLineItemPence({ quantity: 3, unitPrice: 0.1 });
    expect(result).toEqual({ ok: true, linePence: 30 });
  });
});

describe('calculateInvoiceTotals', () => {
  const baseItems = [
    { quantity: 2, unitPrice: 50, lineDiscount: 0 },
    { quantity: 1, unitPrice: 30, lineDiscount: 5 },
  ];

  it('computes subtotal, total, and amountDue with no discount/tax/deposit/payments', () => {
    const { ok, totals } = calculateInvoiceTotals({ items: baseItems });
    expect(ok).toBe(true);
    expect(totals.subtotal).toBe(125); // 100 + 25
    expect(totals.total).toBe(125);
    expect(totals.amountDue).toBe(125);
    expect(totals.amountPaid).toBe(0);
  });

  it('applies a document discount before tax', () => {
    const { totals } = calculateInvoiceTotals({ items: baseItems, documentDiscount: 25 });
    expect(totals.total).toBe(100);
  });

  it('rejects a document discount larger than the subtotal', () => {
    const result = calculateInvoiceTotals({ items: baseItems, documentDiscount: 999 });
    expect(result.ok).toBe(false);
  });

  it('never applies VAT unless vatEnabled is explicitly true', () => {
    const { totals } = calculateInvoiceTotals({ items: baseItems, vatRatePercent: 20 });
    expect(totals.taxTotal).toBe(0);
    expect(totals.total).toBe(125);
  });

  it('applies VAT correctly when vatEnabled is true', () => {
    const { totals } = calculateInvoiceTotals({ items: baseItems, vatEnabled: true, vatRatePercent: 20 });
    expect(totals.taxTotal).toBe(25); // 20% of 125
    expect(totals.total).toBe(150);
  });

  it('applies the £30 deposit and reduces amountDue', () => {
    const { totals } = calculateInvoiceTotals({ items: baseItems, depositApplied: 30 });
    expect(totals.depositApplied).toBe(30);
    expect(totals.amountDue).toBe(95);
  });

  it('rejects a deposit larger than the total', () => {
    const result = calculateInvoiceTotals({ items: baseItems, depositApplied: 999 });
    expect(result.ok).toBe(false);
  });

  it('subtracts recorded payments from amountDue and marks partially paid via derivePaymentStatus', () => {
    const { totals } = calculateInvoiceTotals({
      items: baseItems,
      depositApplied: 30,
      payments: [{ amount: 50 }],
    });
    expect(totals.amountPaid).toBe(50);
    expect(totals.amountDue).toBe(45);
    expect(derivePaymentStatus(totals.amountDue, totals.total)).toBe('partially_paid');
  });

  it('excludes reversed payments from amountPaid', () => {
    const { totals } = calculateInvoiceTotals({
      items: baseItems,
      payments: [{ amount: 50 }, { amount: 20, reversedAt: '2026-01-01T00:00:00Z' }],
    });
    expect(totals.amountPaid).toBe(50);
  });

  it('rejects overpayment (payments exceeding amount due)', () => {
    const result = calculateInvoiceTotals({
      items: baseItems,
      payments: [{ amount: 1000 }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/overpayment/);
  });

  it('reaches amountDue = 0 exactly when fully paid (full/partial → paid transition)', () => {
    const { totals } = calculateInvoiceTotals({
      items: baseItems,
      payments: [{ amount: 125 }],
    });
    expect(totals.amountDue).toBe(0);
    expect(derivePaymentStatus(totals.amountDue, totals.total)).toBe('paid');
  });

  it('rejects an empty items array', () => {
    const result = calculateInvoiceTotals({ items: [] });
    expect(result.ok).toBe(false);
  });

  it('rounds decimal pounds correctly across multiple lines (no float drift)', () => {
    const { totals } = calculateInvoiceTotals({
      items: [
        { quantity: 3, unitPrice: 19.99 },
        { quantity: 1, unitPrice: 0.01 },
      ],
    });
    expect(totals.subtotal).toBe(59.98); // 59.97 + 0.01, verifying no 59.979999999999 drift
  });
});

describe('validateNewPaymentAmount', () => {
  it('accepts a payment within the outstanding balance', () => {
    expect(validateNewPaymentAmount(50, 100).ok).toBe(true);
  });

  it('rejects a payment exceeding the outstanding balance', () => {
    expect(validateNewPaymentAmount(150, 100).ok).toBe(false);
  });

  it('rejects a zero or negative amount', () => {
    expect(validateNewPaymentAmount(0, 100).ok).toBe(false);
    expect(validateNewPaymentAmount(-10, 100).ok).toBe(false);
  });

  it('accepts a payment that exactly matches the outstanding balance', () => {
    expect(validateNewPaymentAmount(100, 100).ok).toBe(true);
  });
});

describe('isOverdue', () => {
  const today = new Date('2026-07-16T12:00:00Z');

  it('is overdue when issued, balance owed, and due date has passed', () => {
    expect(isOverdue({ documentStatus: 'issued', amountDue: 10, dueDate: '2026-07-01' }, today)).toBe(true);
  });

  it('is not overdue when balance is zero even if due date has passed', () => {
    expect(isOverdue({ documentStatus: 'issued', amountDue: 0, dueDate: '2026-07-01' }, today)).toBe(false);
  });

  it('is not overdue while still a draft', () => {
    expect(isOverdue({ documentStatus: 'draft', amountDue: 10, dueDate: '2026-07-01' }, today)).toBe(false);
  });

  it('is not overdue when due date is in the future', () => {
    expect(isOverdue({ documentStatus: 'issued', amountDue: 10, dueDate: '2026-08-01' }, today)).toBe(false);
  });

  it('is not overdue when void', () => {
    expect(isOverdue({ documentStatus: 'void', amountDue: 10, dueDate: '2026-07-01' }, today)).toBe(false);
  });
});
