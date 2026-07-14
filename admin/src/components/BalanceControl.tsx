import { useState } from 'react';
import { authFetch, ApiError } from '../lib/authFetch';
import {
  balanceStatusBadge,
  balanceStatusLabel,
  balancePaymentMethodLabel,
  paymentStatusBadge,
  formatCurrency,
  formatDateTime,
} from '../lib/format';
import { BALANCE_STATUS_VALUES, BALANCE_PAYMENT_METHOD_VALUES } from '../types/booking';
import type { BalanceUpdateResponse } from '../types/booking';
import StatusBadge from './StatusBadge';

interface Props {
  bookingId: string;
  totalPrice: number | null;
  depositAmount: number | null;
  balance: number | null;
  paymentStatus: string | null;
  balanceStatus: string | null;
  balancePaidAt: string | null;
  balancePaymentMethod: string | null;
  onUpdated: (fields: BalanceUpdateResponse) => void;
}

// Internal manual record only — this component never calls Stripe and never
// touches payment_status/deposit_amount/total_price (enforced server-side
// too). Deposit payment_status and balance_status are always shown as two
// separate badges — a paid deposit must never read the same as a fully
// settled balance (ADMIN_CRM_PLAN.md Phase 3 7).
export default function BalanceControl({
  bookingId,
  totalPrice,
  depositAmount,
  balance,
  paymentStatus,
  balanceStatus,
  balancePaidAt,
  balancePaymentMethod,
  onUpdated,
}: Props) {
  const [nextStatus, setNextStatus] = useState(balanceStatus ?? 'not_due');
  const [nextMethod, setNextMethod] = useState(balancePaymentMethod ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty =
    nextStatus !== (balanceStatus ?? 'not_due') ||
    (nextStatus === 'paid' && nextMethod !== (balancePaymentMethod ?? ''));

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await authFetch<BalanceUpdateResponse>(`/api/bookings/${bookingId}/balance`, {
        method: 'PATCH',
        body: JSON.stringify({
          balanceStatus: nextStatus,
          ...(nextStatus === 'paid' && nextMethod ? { balancePaymentMethod: nextMethod } : {}),
        }),
      });
      onUpdated(result);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the balance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <dl className="mb-3 grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-navy-700">Total price</dt>
        <dd className="text-right text-navy-950">{formatCurrency(totalPrice)}</dd>
        <dt className="text-navy-700">Deposit payment</dt>
        <dd className="text-right text-navy-950">{formatCurrency(depositAmount)}</dd>
        <dt className="text-navy-700">Remaining balance</dt>
        <dd className="text-right text-navy-950">
          {totalPrice === null
            ? 'Total not recorded — balance cannot be calculated.'
            : balance === null
              ? 'Balance unavailable'
              : formatCurrency(balance)}
        </dd>
      </dl>

      <div className="mb-3 flex flex-wrap gap-2">
        <StatusBadge {...paymentStatusBadge(paymentStatus)} />
        <StatusBadge {...balanceStatusBadge(balanceStatus)} />
      </div>

      {balancePaidAt && (
        <p className="mb-3 text-xs text-navy-500">
          Balance paid: {formatDateTime(balancePaidAt)}
          {balancePaymentMethod ? ` · ${balancePaymentMethodLabel(balancePaymentMethod)}` : ''}
        </p>
      )}

      <label htmlFor="balance-status-select" className="mb-1.5 block text-sm font-medium text-navy-900">
        Update balance status
      </label>
      <select
        id="balance-status-select"
        value={nextStatus}
        onChange={(e) => setNextStatus(e.target.value)}
        disabled={saving}
        className="mb-2 min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-sky-500 disabled:opacity-60"
      >
        {BALANCE_STATUS_VALUES.map((v) => (
          <option key={v} value={v}>
            {balanceStatusLabel(v)}
          </option>
        ))}
      </select>

      {nextStatus === 'paid' && (
        <>
          <label htmlFor="balance-method-select" className="mb-1.5 block text-sm font-medium text-navy-900">
            Payment method
          </label>
          <select
            id="balance-method-select"
            value={nextMethod}
            onChange={(e) => setNextMethod(e.target.value)}
            disabled={saving}
            className="mb-2 min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-sky-500 disabled:opacity-60"
          >
            <option value="">Not specified</option>
            {BALANCE_PAYMENT_METHOD_VALUES.map((v) => (
              <option key={v} value={v}>
                {balancePaymentMethodLabel(v)}
              </option>
            ))}
          </select>
        </>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || !dirty}
        className="min-h-11 w-full rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save balance status'}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-2 text-sm text-green-700">
          Balance updated.
        </p>
      )}
    </div>
  );
}
