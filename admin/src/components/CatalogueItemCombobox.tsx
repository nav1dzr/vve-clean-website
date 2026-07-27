import { useState, useRef, useEffect, useId } from 'react';
import { authFetch, ApiError } from '../lib/authFetch';
import { formatMoney } from '../lib/format';
import type { CatalogueItem, CatalogueListResponse } from '../types/catalogue';

interface Props {
  onSelect: (item: CatalogueItem) => void;
}

const DEBOUNCE_MS = 250;

const inputClass =
  'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

// Searchable "Add product or service" picker for the invoice editor.
// Fetches active catalogue items server-side (debounced) — unlike
// ServiceTemplateCombobox, whose options are a static client-side list.
// Selecting an item hands the whole CatalogueItem to the caller, which
// appends a plain, editable invoice line (no catalogue id is kept, so the
// line and the catalogue item can never mutate each other).
export default function CatalogueItemCombobox({ onSelect }: Props) {
  const uid = useId();
  const inputId = `catalogue-input-${uid}`;
  const listId = `catalogue-list-${uid}`;
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CatalogueItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounced server search. Empty search still lists the active catalogue
  // (the API returns all active items when q is absent), so focusing the
  // field shows everything without typing.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const q = search.trim();
      const path = q ? `/api/catalogue?status=active&q=${encodeURIComponent(q)}` : '/api/catalogue?status=active';
      authFetch<CatalogueListResponse>(path)
        .then((data) => {
          setOptions(data.results);
          setLoadError(null);
        })
        .catch((err) => {
          setOptions([]);
          setLoadError(err instanceof ApiError ? err.message : 'Could not load catalogue items.');
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, open]);

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function applyOption(item: CatalogueItem) {
    onSelect(item);
    setSearch('');
    setOptions([]);
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setActiveIndex((i) => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < options.length) {
        applyOption(options[activeIndex]);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      close();
    }
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className={labelClass}>
        Add product or service
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder="Search saved items — adds a new editable line"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(close, 150);
        }}
        onKeyDown={handleKeyDown}
        className={inputClass}
        data-testid="catalogue-combobox"
      />
      {loadError && open && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {loadError}
        </p>
      )}
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Saved products and services"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-silver-300 bg-white shadow-lg"
        >
          {options.map((item, idx) => (
            <li
              key={item.id}
              id={`${listId}-opt-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => {
                // Prevent input blur from firing before click resolves.
                e.preventDefault();
                clearTimeout(blurTimer.current);
                applyOption(item);
              }}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${idx === activeIndex ? 'bg-sky-50 text-sky-900' : 'text-navy-900 hover:bg-silver-50'}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.name}</span>
                {item.category && <span className="block truncate text-xs text-navy-500">{item.category}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.itemType === 'service' ? 'bg-sky-100 text-sky-700' : 'bg-silver-200 text-navy-700'}`}>
                  {item.itemType === 'service' ? 'Service' : 'Product'}
                </span>
                <span className="font-medium text-navy-950">{formatMoney(item.defaultPricePence / 100)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
