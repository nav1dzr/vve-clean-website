import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { authFetch, ApiError } from '../lib/authFetch';
import type {
  CustomerDetail, CustomerDraftInput, CustomerCreateResponse, CustomerUpdateResponse, CustomerDuplicateWarning,
} from '../types/customer';
import { CUSTOMER_TYPE_VALUES, CUSTOMER_SOURCE_VALUES, CUSTOMER_CONTACT_METHOD_VALUES } from '../types/customer';
import { customerTypeLabel } from '../lib/format';
import ErrorState from '../components/ErrorState';
import { CardListSkeleton } from '../components/Skeleton';

interface FormValue {
  name: string; email: string; phone: string; address: string; postcode: string;
  customerType: string; source: string; preferredContactMethod: string; notes: string;
}

function emptyValue(): FormValue {
  return { name: '', email: '', phone: '', address: '', postcode: '', customerType: 'individual', source: 'other', preferredContactMethod: '', notes: '' };
}

type LoadState = { status: 'ready' } | { status: 'loading' } | { status: 'error'; message: string };

// /customers/new and /customers/:id/edit — the same form for both. Never
// auto-merges a duplicate — a match found on save is shown as a dismissible
// warning banner after the record is created/updated, exactly per the
// original spec's "never auto-merge, never merge on name alone" rule.
export default function CustomerFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [value, setValue] = useState<FormValue>(emptyValue());
  const [load, setLoad] = useState<LoadState>({ status: isEdit ? 'loading' : 'ready' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<CustomerDuplicateWarning[]>([]);

  useEffect(() => {
    if (!id) return;
    authFetch<CustomerDetail>(`/api/customers/${id}`)
      .then((c) => {
        setValue({
          name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', postcode: c.postcode || '',
          customerType: c.customerType, source: c.source, preferredContactMethod: c.preferredContactMethod || '', notes: c.notes || '',
        });
        setLoad({ status: 'ready' });
      })
      .catch((err) => setLoad({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load this customer.' }));
  }, [id]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!value.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const input: CustomerDraftInput = {
      name: value.name.trim(),
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      address: value.address.trim() || null,
      postcode: value.postcode.trim() || null,
      customerType: value.customerType as CustomerDraftInput['customerType'],
      source: value.source as CustomerDraftInput['source'],
      preferredContactMethod: (value.preferredContactMethod || null) as CustomerDraftInput['preferredContactMethod'],
      notes: value.notes.trim() || null,
    };

    try {
      if (isEdit && id) {
        const result = await authFetch<CustomerUpdateResponse>(`/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
        if (result.duplicateWarnings.length > 0) {
          setWarnings(result.duplicateWarnings);
          setSubmitting(false);
          return;
        }
        navigate(`/customers/${id}`);
      } else {
        const result = await authFetch<CustomerCreateResponse>('/api/customers', { method: 'POST', body: JSON.stringify(input) });
        if (result.duplicateWarnings.length > 0) {
          setWarnings(result.duplicateWarnings);
          setSubmitting(false);
          // Still land on the new record — the admin can decide for
          // themselves whether it's genuinely a duplicate; the record
          // already exists and is never silently discarded or merged.
          navigate(`/customers/${result.id}`);
          return;
        }
        navigate(`/customers/${result.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this customer.');
      setSubmitting(false);
    }
  }

  if (load.status === 'loading') {
    return <div className="px-4 py-6 sm:px-6"><CardListSkeleton count={1} /></div>;
  }
  if (load.status === 'error') {
    return <div className="px-4 py-6 sm:px-6"><ErrorState message={load.message} onRetry={() => setLoad({ status: 'loading' })} /></div>;
  }

  const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
  const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

  return (
    <div className="px-4 py-6 sm:px-6">
      <Link to={isEdit && id ? `/customers/${id}` : '/customers'} className="mb-3 inline-block text-sm text-sky-600 hover:text-sky-700">
        ← {isEdit ? 'Back to customer' : 'Customers'}
      </Link>
      <h1 className="mb-4 font-semibold text-xl text-navy-950">{isEdit ? 'Edit customer' : 'New customer'}</h1>

      {warnings.length > 0 && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-1 text-sm font-medium text-amber-900">Possible duplicate — saved anyway, nothing was merged:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {warnings.map((w, i) => (
              <li key={i}>
                Matches existing customer <strong>{w.customer.name}</strong> by {w.type === 'postcode_name' ? 'postcode and a similar name' : w.type}.
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Name *</span>
              <input type="text" value={value.name} onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Email</span>
              <input type="email" value={value.email} onChange={(e) => setValue((v) => ({ ...v, email: e.target.value }))} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Phone</span>
              <input type="tel" value={value.phone} onChange={(e) => setValue((v) => ({ ...v, phone: e.target.value }))} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Postcode</span>
              <input type="text" value={value.postcode} onChange={(e) => setValue((v) => ({ ...v, postcode: e.target.value }))} className={inputClass} />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Address</span>
              <input type="text" value={value.address} onChange={(e) => setValue((v) => ({ ...v, address: e.target.value }))} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Customer type</span>
              <select value={value.customerType} onChange={(e) => setValue((v) => ({ ...v, customerType: e.target.value }))} className={inputClass}>
                {CUSTOMER_TYPE_VALUES.map((t) => <option key={t} value={t}>{customerTypeLabel(t)}</option>)}
              </select>
            </label>
            <label>
              <span className={labelClass}>Source</span>
              <select value={value.source} onChange={(e) => setValue((v) => ({ ...v, source: e.target.value }))} className={inputClass}>
                {CUSTOMER_SOURCE_VALUES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </label>
            <label>
              <span className={labelClass}>Preferred contact method</span>
              <select value={value.preferredContactMethod} onChange={(e) => setValue((v) => ({ ...v, preferredContactMethod: e.target.value }))} className={inputClass}>
                <option value="">Not specified</option>
                {CUSTOMER_CONTACT_METHOD_VALUES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Notes</span>
              <textarea value={value.notes} onChange={(e) => setValue((v) => ({ ...v, notes: e.target.value }))} rows={3} className="w-full rounded-lg border border-silver-300 px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500" />
            </label>
          </div>
        </section>

        {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="min-h-11 w-full rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create customer'}
        </button>
      </form>
    </div>
  );
}
