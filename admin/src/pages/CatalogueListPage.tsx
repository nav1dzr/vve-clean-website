import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authFetch, ApiError } from '../lib/authFetch';
import { formatMoney } from '../lib/format';
import type {
  CatalogueItem, CatalogueItemType, CatalogueListResponse, CatalogueSeedResponse, CatalogueStatus,
} from '../types/catalogue';
import Modal from '../components/Modal';
import ErrorState from '../components/ErrorState';

const DEBOUNCE_MS = 300;

const inputClass =
  'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; items: CatalogueItem[] };

interface FormState {
  name: string;
  pricePounds: string;
  itemType: CatalogueItemType;
  category: string;
  description: string;
}

const emptyForm: FormState = { name: '', pricePounds: '', itemType: 'service', category: '', description: '' };

function itemTypeBadge(itemType: CatalogueItemType) {
  return itemType === 'service'
    ? 'bg-sky-100 text-sky-700'
    : 'bg-silver-200 text-navy-700';
}

// Products & Services catalogue — saved, reusable invoice line items.
// Admin-only (every call goes through authFetch + verifyAdminRequest);
// items are archived rather than deleted so an invoice created from one
// always keeps meaning.
export default function CatalogueListPage() {
  const [statusFilter, setStatusFilter] = useState<CatalogueStatus>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [state, setState] = useState<ListState>({ status: 'loading' });

  const [modalItem, setModalItem] = useState<CatalogueItem | null>(null); // null = create
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);

  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [seedConfirm, setSeedConfirm] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  function load() {
    setState({ status: 'loading' });
    const params = new URLSearchParams({ status: statusFilter });
    if (debouncedSearch) params.set('q', debouncedSearch);
    authFetch<CatalogueListResponse>(`/api/catalogue?${params.toString()}`)
      .then((data) => setState({ status: 'success', items: data.results }))
      .catch((err) =>
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load catalogue items.' }),
      );
  }

  useEffect(load, [statusFilter, debouncedSearch]);

  function openCreate() {
    setModalItem(null);
    setForm(emptyForm);
    setSubmitError(null);
    setModalOpen(true);
  }

  function openEdit(item: CatalogueItem) {
    setModalItem(item);
    setForm({
      name: item.name,
      pricePounds: (item.defaultPricePence / 100).toString(),
      itemType: item.itemType,
      category: item.category ?? '',
      description: item.description ?? '',
    });
    setSubmitError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    newButtonRef.current?.focus();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const name = form.name.trim();
    if (!name) {
      setSubmitError('Enter a name.');
      return;
    }
    const pounds = Number(form.pricePounds);
    if (!form.pricePounds.trim() || !Number.isFinite(pounds) || pounds < 0) {
      setSubmitError('Enter a valid default price (0 or more).');
      return;
    }
    // Convert to integer pence at the boundary — the API only accepts pence.
    const defaultPricePence = Math.round(pounds * 100);

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        name,
        defaultPricePence,
        itemType: form.itemType,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
      };
      if (modalItem) {
        await authFetch<CatalogueItem>(`/api/catalogue?id=${encodeURIComponent(modalItem.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await authFetch<CatalogueItem>('/api/catalogue', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not save this item.');
    } finally {
      setSubmitting(false);
    }
  }

  async function setItemStatus(item: CatalogueItem, status: CatalogueStatus) {
    setActionError(null);
    setArchiveConfirmId(null);
    try {
      await authFetch<CatalogueItem>(`/api/catalogue?id=${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update this item.');
    }
  }

  async function handleSeed() {
    if (!seedConfirm) {
      setSeedConfirm(true);
      return;
    }
    setSeedConfirm(false);
    setSeedBusy(true);
    setSeedMessage(null);
    setActionError(null);
    try {
      const result = await authFetch<CatalogueSeedResponse>('/api/catalogue?action=seed', { method: 'POST' });
      setSeedMessage(
        result.inserted === 0
          ? `Nothing new to import — ${result.skipped} items already exist.`
          : `Imported ${result.inserted} items from the standard price list (${result.skipped} already existed).`,
      );
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not import the standard price list.');
    } finally {
      setSeedBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-navy-950">Products &amp; Services</h1>
        <button
          ref={newButtonRef}
          type="button"
          onClick={openCreate}
          className="min-h-11 rounded-lg bg-navy-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900"
        >
          + New item
        </button>
      </div>

      <p className="mb-4 text-sm text-navy-700">
        Saved invoice items — add them to a draft invoice from the invoice editor instead of retyping
        the name and price. Archived items are hidden from the invoice editor but never deleted.
      </p>

      <div className="mb-4 rounded-xl border border-silver-300 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Standard price list</h2>
            <p className="mt-1 text-sm text-navy-700">
              One-off import of the prices published on the website (end of tenancy, carpets, upholstery,
              add-ons, windows, gutters). Existing items are skipped — your edits are never overwritten.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seedBusy}
            className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-60 ${
              seedConfirm
                ? 'bg-navy-950 text-white hover:bg-navy-900'
                : 'border border-silver-300 text-navy-900 hover:bg-silver-100'
            }`}
          >
            {seedBusy ? 'Importing…' : seedConfirm ? 'Click again to confirm import' : 'Import standard price list'}
          </button>
        </div>
        {seedMessage && <p className="mt-2 text-sm text-green-700">{seedMessage}</p>}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Search catalogue items</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or category…"
            className={inputClass}
          />
        </label>
        <div className="flex rounded-lg border border-silver-300" role="group" aria-label="Status filter">
          {(['active', 'archived'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={`min-h-11 flex-1 px-4 text-sm font-medium capitalize transition-colors sm:flex-none ${
                statusFilter === s ? 'bg-navy-950 text-white' : 'bg-white text-navy-700 hover:bg-silver-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {actionError}
        </p>
      )}

      {state.status === 'loading' && <p className="text-sm text-navy-500">Loading catalogue…</p>}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'success' && state.items.length === 0 && (
        <p className="rounded-xl border border-silver-300 bg-white p-4 text-sm text-navy-500">
          {debouncedSearch
            ? 'No items match this search.'
            : statusFilter === 'active'
              ? 'No active items yet — create one, or import the standard price list above.'
              : 'No archived items.'}
        </p>
      )}
      {state.status === 'success' && state.items.length > 0 && (
        <ul className="space-y-2">
          {state.items.map((item) => (
            <li key={item.id} className="rounded-xl border border-silver-300 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-navy-950">{item.name}</p>
                  {item.description && <p className="mt-0.5 text-sm text-navy-700">{item.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${itemTypeBadge(item.itemType)}`}>
                      {item.itemType === 'service' ? 'Service' : 'Product'}
                    </span>
                    {item.category && <span className="text-navy-500">{item.category}</span>}
                  </div>
                </div>
                <p className="shrink-0 font-semibold text-navy-950">{formatMoney(item.defaultPricePence / 100)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900 hover:bg-silver-100"
                >
                  Edit
                </button>
                {item.status === 'active' ? (
                  archiveConfirmId === item.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setItemStatus(item, 'archived')}
                        className="min-h-11 rounded-lg bg-red-700 px-3 text-sm font-medium text-white hover:bg-red-800"
                      >
                        Confirm archive
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchiveConfirmId(null)}
                        className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900 hover:bg-silver-100"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setArchiveConfirmId(item.id)}
                      className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-medium text-red-700 hover:bg-silver-100"
                    >
                      Archive
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => setItemStatus(item, 'active')}
                    className="min-h-11 rounded-lg border border-silver-300 px-3 text-sm font-medium text-navy-900 hover:bg-silver-100"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <Modal
          titleId="catalogue-item-form-title"
          title={modalItem ? 'Edit catalogue item' : 'New catalogue item'}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit}>
            <label htmlFor="ci-name" className={labelClass}>
              Name *
            </label>
            <input
              id="ci-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={`${inputClass} mb-3`}
            />

            <label htmlFor="ci-price" className={labelClass}>
              Default price (£) *
            </label>
            <input
              id="ci-price"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 50 or 22.50"
              value={form.pricePounds}
              onChange={(e) => setForm((f) => ({ ...f, pricePounds: e.target.value }))}
              className={`${inputClass} mb-3`}
            />

            <label htmlFor="ci-type" className={labelClass}>
              Type
            </label>
            <select
              id="ci-type"
              value={form.itemType}
              onChange={(e) => setForm((f) => ({ ...f, itemType: e.target.value as CatalogueItemType }))}
              className={`${inputClass} mb-3`}
            >
              <option value="service">Service</option>
              <option value="product">Product</option>
            </select>

            <label htmlFor="ci-category" className={labelClass}>
              Category (optional)
            </label>
            <input
              id="ci-category"
              type="text"
              placeholder="e.g. Carpets, End of tenancy"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={`${inputClass} mb-3`}
            />

            <label htmlFor="ci-description" className={labelClass}>
              Description (optional)
            </label>
            <textarea
              id="ci-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mb-1 w-full rounded-lg border border-silver-300 px-3 py-2 text-base text-navy-950 outline-none focus:border-sky-500"
            />

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
                {submitting ? 'Saving…' : modalItem ? 'Save changes' : 'Create item'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
