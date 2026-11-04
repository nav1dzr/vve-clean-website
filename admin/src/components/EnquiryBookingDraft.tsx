import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, authFetch } from '../lib/authFetch';
import { enquiryDetailsPath, type Enquiry, type EnquiryBookingContext } from '../types/enquiry';
import type { BookingContactRole, CustomerCard, CustomerListResponse, ManualBookingInput, ManualBookingResponse } from '../types/customer';
import Modal from './Modal';
import ManualBookingModal from './ManualBookingModal';

const roles = [
  { key: 'tenant', label: 'Tenant' }, { key: 'payer', label: 'Payer' }, { key: 'agent', label: 'Agent' },
] as const;
const control = 'min-h-11 rounded-lg border border-silver-300 bg-white px-3 text-sm text-navy-950 disabled:opacity-50';

type ContactRole = 'primary' | BookingContactRole;

export default function EnquiryBookingDraft({ enquiry, ownerId, onClose }: {
  enquiry: Enquiry; ownerId: string; onClose: () => void;
}) {
  const navigate = useNavigate();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [context, setContext] = useState<EnquiryBookingContext | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [contacts, setContacts] = useState<Partial<Record<ContactRole, CustomerCard>>>({});
  const [role, setRole] = useState<ContactRole>('primary');
  const [query, setQuery] = useState(enquiry.full_name || '');
  const [search, setSearch] = useState({ query: '', attempt: 0 });
  const [matches, setMatches] = useState<{ query: string; results: CustomerCard[]; error?: string } | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError('');
    authFetch<EnquiryBookingContext>(enquiryDetailsPath(enquiry.id)).then((result) => {
      if (active && result.enquiry.id === enquiry.id) setContext(result);
    }).catch((error) => {
      if (active) setLoadError(error instanceof ApiError ? error.message : 'Could not open this enquiry.');
    });
    return () => { active = false; };
  }, [enquiry.id, loadAttempt]);

  useEffect(() => {
    if (!search.query) return;
    let active = true;
    authFetch<CustomerListResponse>('/api/customers?q=' + encodeURIComponent(search.query) + '&pageSize=10')
      .then(({ results }) => { if (active) setMatches({ query: search.query, results }); })
      .catch((error) => {
        if (active) setMatches({ query: search.query, results: [], error: error instanceof ApiError ? error.message : 'Could not search customers.' });
      });
    return () => { active = false; };
  }, [search]);

  function findCustomers(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setMatches(null);
    setSearch((current) => ({ query: query.trim(), attempt: current.attempt + 1 }));
  }

  function selectCustomer(customer: CustomerCard) {
    setContacts((current) => ({ ...current, [role]: customer }));
    setMatches(null);
    setSearch({ query: '', attempt: 0 });
  }

  const primary = contacts.primary;
  const contactRoles = Object.fromEntries(roles.flatMap(({ key }) => contacts[key] ? [[key, contacts[key].id]] : []));
  const visibleMatches = matches?.query === query.trim() ? matches : null;

  async function create(input: ManualBookingInput) {
    if (!primary) return;
    const result = await authFetch<ManualBookingResponse>('/api/customers/' + primary.id + '?action=bookings', {
      method: 'POST', body: JSON.stringify(input),
    });
    if (mounted.current) navigate('/bookings/' + result.bookingId, result.alreadyExisted ? { state: { reopenedEnquiryDraft: true } } : undefined);
  }

  if (draftOpen && context && primary) {
    return <ManualBookingModal ownerId={ownerId} customerId={primary.id} customerEmail={primary.email}
      onClose={() => {
        setDraftOpen(false);
        setContext(null);
        setLoadAttempt((attempt) => attempt + 1);
      }} onCreate={create}
      enquiry={{ id: enquiry.id, updatedAt: context.enquiry.updated_at, service: context.enquiry.service || '',
        contactSummary: 'Booking contact ' + primary.name, contactRoles }} />;
  }

  return <Modal titleId="enquiry-booking-draft-title" title="Start a booking draft" onClose={onClose} wide>
    {loadError && <div className="space-y-2"><p role="alert" className="text-sm text-red-700">{loadError}</p>
      <button type="button" className={control} onClick={() => setLoadAttempt((n) => n + 1)}>Retry enquiry</button></div>}
    {!context && !loadError && <p role="status">Checking the saved enquiry…</p>}
    {context?.booking && <div className="space-y-3 text-sm">
      <p>A booking already exists for this enquiry.</p>
      <Link className="font-semibold text-sky-700 underline" to={'/bookings/' + context.booking.id}>Open booking {context.booking.reference || ''}</Link>
    </div>}
    {context && !context.booking && <>
      <p className="mb-3 text-sm text-navy-700">Choose the contact for this booking. Tenant, payer and agent are optional. Those role links help staff find the right records. Review the recipient separately before sending any email or invoice.</p>
      <div className="mb-4 rounded-lg bg-silver-100 p-3 text-sm">
        <p className="font-semibold">{context.enquiry.full_name}</p>
        <p className="break-all">{[context.enquiry.email, context.enquiry.phone].filter(Boolean).join(' · ')}</p>
      </div>
      <dl className="mb-4 space-y-2 text-sm">
        <div><dt className="font-semibold">Booking contact</dt><dd>{primary?.name || 'Choose a customer below'}</dd></div>
        {roles.filter(({ key }) => contacts[key]).map(({ key, label }) => <div key={key} className="flex items-center justify-between gap-2">
          <div><dt className="font-semibold">{label}</dt><dd>{contacts[key]?.name}</dd></div>
          <button type="button" className={control} aria-label={'Remove ' + label.toLowerCase()} onClick={() => setContacts((current) => ({ ...current, [key]: undefined }))}>Remove</button>
        </div>)}
      </dl>
      <form onSubmit={findCustomers} className="mb-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">Contact role
          <select className={control} value={role} onChange={(event) => setRole(event.target.value as ContactRole)}>
            <option value="primary">Booking contact</option>
            {roles.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="grid flex-1 gap-1 text-sm">Name, email or phone
          <input className={control} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={160} />
        </label>
        <button type="submit" className={control} disabled={!query.trim()}>Find customers</button>
      </form>
      {search.query === query.trim() && search.query && !matches && <p role="status" className="text-sm">Searching customers…</p>}
      {visibleMatches?.error && <p role="alert" className="text-sm text-red-700">{visibleMatches.error}</p>}
      {visibleMatches && !visibleMatches.error && (visibleMatches.results.length
        ? <ul className="mb-3 divide-y divide-silver-200">
          {visibleMatches.results.map((customer) => <li key={customer.id}>
            <button type="button" onClick={() => selectCustomer(customer)} className="min-h-11 w-full py-2 text-left text-sm hover:text-sky-700">
              <span className="block font-semibold">{customer.name}</span>
              <span className="break-all text-navy-700">{[customer.email, customer.phone, customer.postcode].filter(Boolean).join(' · ')}</span>
            </button>
          </li>)}
        </ul> : <p role="status" className="text-sm">No customers matched this search.</p>)}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link to={'/customers/new?fromEnquiryId=' + encodeURIComponent(enquiry.id)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-700 underline">Add enquiry contact in a new tab</Link>
        <button type="button" disabled={!primary} onClick={() => setDraftOpen(true)} className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white disabled:opacity-50">Continue to booking details</button>
      </div>
    </>}
  </Modal>;
}
