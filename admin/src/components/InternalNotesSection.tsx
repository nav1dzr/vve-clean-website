import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authFetch, ApiError } from '../lib/authFetch';
import type { InternalNote, NotesResponse } from '../types/booking';
import { formatDateTime } from '../lib/format';
import Modal from './Modal';
import ErrorState from './ErrorState';

const MAX_NOTE_LENGTH = 2000;

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; notes: InternalNote[] };

// Append-only — there is no edit/delete affordance anywhere in this
// component, matching the API (ADMIN_CRM_PLAN.md Phase 3 20).
export default function InternalNotesSection({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [modalOpen, setModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  function load() {
    setState({ status: 'loading' });
    authFetch<NotesResponse>(`/api/bookings/${bookingId}/notes`)
      .then((data) => setState({ status: 'success', notes: data.notes }))
      .catch((err) =>
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load notes.' }),
      );
  }

  useEffect(load, [bookingId]);

  function openModal() {
    setNoteText('');
    setSubmitError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    addButtonRef.current?.focus();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return; // belt-and-braces against a double Enter/click

    const trimmed = noteText.trim();
    if (!trimmed) {
      setSubmitError('Enter a note before saving.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await authFetch<InternalNote>(`/api/bookings/${bookingId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: trimmed }),
      });
      setState((prev) => (prev.status === 'success' ? { status: 'success', notes: [created, ...prev.notes] } : prev));
      setModalOpen(false);
      addButtonRef.current?.focus();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not save this note.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Internal notes</h2>
        <button
          ref={addButtonRef}
          type="button"
          onClick={openModal}
          className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900 transition-colors hover:bg-silver-100"
        >
          + Add note
        </button>
      </div>
      <p className="mb-3 text-xs text-navy-500">Visible only to authorised VVE staff.</p>

      {state.status === 'loading' && <p className="text-sm text-navy-500">Loading notes…</p>}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'success' && state.notes.length === 0 && (
        <p className="text-sm text-navy-500">No internal notes yet.</p>
      )}
      {state.status === 'success' && state.notes.length > 0 && (
        <ul className="space-y-3">
          {state.notes.map((n) => (
            <li key={n.id} className="border-t border-silver-200 pt-3 first:border-t-0 first:pt-0">
              <p className="whitespace-pre-wrap text-sm text-navy-900">{n.note}</p>
              <p className="mt-1 text-xs text-navy-500">
                {n.author.displayName} · {formatDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <Modal titleId="add-note-title" title="Add internal note" onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <label htmlFor="note-text" className="mb-1.5 block text-sm font-medium text-navy-900">
              Note
            </label>
            <textarea
              id="note-text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              rows={4}
              maxLength={MAX_NOTE_LENGTH}
              className="w-full rounded-lg border border-silver-300 px-3 py-2 text-sm text-navy-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
            <p className="mt-1 text-right text-xs text-navy-500">
              {noteText.length}/{MAX_NOTE_LENGTH}
            </p>

            {submitError && (
              <p role="alert" className="mb-2 text-sm text-red-600">
                {submitError}
              </p>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="min-h-11 rounded-lg border border-silver-300 px-4 text-sm font-medium text-navy-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
