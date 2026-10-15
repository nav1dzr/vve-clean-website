import { useEffect, useState } from 'react';
import { bookingContent } from '../../shared/bookingPresentation.js';

interface Props {
  serviceDate: string;
  descriptions: string[];
  onAdd: (text: string) => void;
}

// Drafting assistance only. A booked service is not evidence of completed work.
export default function CleaningRecordBuilder({ serviceDate, descriptions, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [work, setWork] = useState('');
  const [exceptions, setExceptions] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(serviceDate) && serviceDate <= today;
  useEffect(() => { setConfirmed(false); }, [serviceDate]);

  function start() {
    setWork(bookingContent({ items: descriptions.join('\n').replace(/^\d+(?:\.\d+)? x (?=(?:Parking\s*:|Congestion Charge\b|ULEZ\b|Access charges?\s*:))/gmi, '') }).cleaning.join('\n'));
    setExceptions('');
    setConfirmed(false);
    setOpen(true);
  }

  function add() {
    if (!confirmed || !validDate || !work.trim()) return;
    const date = new Date(`${serviceDate}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' });
    onAdd([
      'CLEANING COMPLETION RECORD',
      `Service completed on ${date}.`,
      'Work carried out:',
      work.trim(),
      exceptions.trim() ? `Exceptions / work not carried out:\n${exceptions.trim()}` : '',
      'This records the cleaning carried out by VVE Clean. It is not an independent property inspection or a guarantee of tenancy deposit release.',
    ].filter(Boolean).join('\n'));
    setOpen(false);
  }

  if (!open) return <button type="button" onClick={start} className="min-h-11 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">Add cleaning completion record</button>;

  return <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
    <h3 className="font-semibold text-navy-950">Record the work you completed</h3>
    <p className="text-sm text-navy-700">Start with the invoice items below. Add the rooms and tasks you cleaned, remove anything not done, and note any exceptions. Your existing customer notes will be kept.</p>
    <label className="block text-sm font-medium text-navy-900">Work carried out
      <textarea value={work} onChange={e => { setWork(e.target.value); setConfirmed(false); }} maxLength={6000} rows={7} className="mt-1 w-full rounded-lg border border-silver-300 px-3 py-2 text-base" />
    </label>
    <label className="block text-sm font-medium text-navy-900">Exceptions or areas not cleaned (optional)
      <textarea value={exceptions} onChange={e => { setExceptions(e.target.value); setConfirmed(false); }} maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-silver-300 px-3 py-2 text-base" />
    </label>
    {!validDate && <p role="alert" className="text-sm text-red-700">Set the actual service date above to today or an earlier date before adding a completion record.</p>}
    <label className="flex items-start gap-2 text-sm text-navy-900"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />I have checked this list and confirm this work was completed on the service date shown above.</label>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!confirmed || !validDate || !work.trim()} onClick={add} className="min-h-11 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Add to invoice and paid receipt</button>
      <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg px-3 py-2 text-sm text-navy-700">Cancel</button>
    </div>
  </div>;
}
