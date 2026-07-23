import { useState, useRef, useId } from 'react';
import { SERVICE_DESCRIPTION_TEMPLATES, type ServiceTemplateGroup } from '../data/serviceDescriptionTemplates';

interface Props {
  itemKey: string;
  onSelect: (description: string) => void;
}

interface FlatOption {
  group: string;
  label: string;
}

function getOptions(search: string): FlatOption[] {
  const q = search.trim().toLowerCase();
  return SERVICE_DESCRIPTION_TEMPLATES.flatMap(({ group, templates }: ServiceTemplateGroup) =>
    templates
      .filter((t) => !q || t.toLowerCase().includes(q))
      .map((label) => ({ group, label })),
  );
}

const inputClass =
  'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none focus:border-sky-500';
const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

export default function ServiceTemplateCombobox({ itemKey, onSelect }: Props) {
  const uid = useId();
  const inputId = `svc-tmpl-input-${uid}`;
  const listId = `svc-tmpl-list-${uid}`;
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();

  const options = getOptions(search);

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function applyOption(label: string) {
    onSelect(label);
    setSearch('');
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
        applyOption(options[activeIndex].label);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      close();
    }
  }

  // Build grouped option elements. Group headers use role="presentation" so
  // they are skipped by aria-activedescendant tracking (which uses flat indices
  // that align with the options array, not the rendered element list).
  function renderOptions() {
    const els: React.ReactNode[] = [];
    let lastGroup = '';
    options.forEach((opt, idx) => {
      if (opt.group !== lastGroup) {
        lastGroup = opt.group;
        els.push(
          <li
            key={`grp-${opt.group}`}
            role="presentation"
            className="bg-silver-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-navy-500"
          >
            {opt.group}
          </li>,
        );
      }
      const isActive = idx === activeIndex;
      els.push(
        <li
          key={opt.label}
          id={`${listId}-opt-${idx}`}
          role="option"
          aria-selected={isActive}
          onMouseDown={(e) => {
            // Prevent input blur from firing before click resolves.
            e.preventDefault();
            clearTimeout(blurTimer.current);
            applyOption(opt.label);
          }}
          className={`cursor-pointer px-3 py-2 text-sm ${isActive ? 'bg-sky-50 text-sky-900' : 'text-navy-900 hover:bg-silver-50'}`}
        >
          {opt.label}
        </li>,
      );
    });
    return els;
  }

  return (
    <div className="relative mb-2">
      <label htmlFor={inputId} className={labelClass}>
        Service template
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
        placeholder="Search or choose a common service"
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
        data-testid={`template-combobox-${itemKey}`}
      />
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Service templates"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-silver-300 bg-white shadow-lg"
        >
          {renderOptions()}
        </ul>
      )}
    </div>
  );
}
