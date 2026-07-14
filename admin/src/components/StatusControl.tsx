import { useState } from 'react';
import { authFetch, ApiError } from '../lib/authFetch';
import { bookingStatusBadge, bookingStatusLabel, STATUS_VALUES_REQUIRING_CONFIRMATION } from '../lib/format';
import { BOOKING_STATUS_VALUES } from '../types/booking';
import type { StatusUpdateResponse } from '../types/booking';
import StatusBadge from './StatusBadge';

interface Props {
  bookingId: string;
  status: string | null;
  onUpdated: (status: string, updatedAt: string) => void;
}

// Routine changes (confirmed, scheduled, ...) apply immediately; cancelled
// and no_show — the two hard-to-casually-undo choices — get an inline
// confirmation step first (ADMIN_CRM_PLAN.md Phase 3 6). Never touches
// payment_status, never calls Stripe, never notifies the customer — the
// server route enforces this too, but the UI copy says so explicitly.
export default function StatusControl({ bookingId, status, onUpdated }: Props) {
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function applyStatus(value: string) {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await authFetch<StatusUpdateResponse>(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: value }),
      });
      onUpdated(result.status, result.updatedAt);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update status.');
    } finally {
      setSaving(false);
      setPendingValue(null);
    }
  }

  function handleChange(value: string) {
    if (value === status) return;
    if (STATUS_VALUES_REQUIRING_CONFIRMATION.has(value)) {
      setPendingValue(value);
      return;
    }
    void applyStatus(value);
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm text-navy-700">Status:</span>
        <StatusBadge {...bookingStatusBadge(status)} />
      </div>

      <label htmlFor="status-select" className="sr-only">
        Update booking status
      </label>
      <select
        id="status-select"
        value={status ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-sky-500 disabled:opacity-60"
      >
        {BOOKING_STATUS_VALUES.map((v) => (
          <option key={v} value={v}>
            {bookingStatusLabel(v)}
          </option>
        ))}
      </select>

      {pendingValue && (
        <div
          role="alertdialog"
          aria-label="Confirm status change"
          className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          <p className="mb-2 text-amber-900">
            Mark this booking as "{bookingStatusLabel(pendingValue)}"? This does not affect payment or send
            anything to the customer.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingValue(null)}
              className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void applyStatus(pendingValue)}
              className="min-h-11 rounded-lg bg-navy-950 px-3 text-sm font-semibold text-white"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {saving && <p className="mt-2 text-sm text-navy-500">Saving…</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-2 text-sm text-green-700">
          Status updated.
        </p>
      )}
    </div>
  );
}
