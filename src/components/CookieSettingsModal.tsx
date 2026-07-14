import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCookieConsent } from '../context/CookieConsentContext';
import type { ConsentCategories } from '../lib/consent';

const TOGGLE_BASE =
  'relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600';

function Toggle({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`${TOGGLE_BASE} ${checked ? 'bg-navy-900' : 'bg-silver-300'} ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function CookieSettingsModal() {
  const { categories, closeSettings, saveChoices, acceptAll, rejectOptional } = useCookieConsent();
  const [draft, setDraft] = useState<ConsentCategories>(categories);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeSettings();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeSettings]);

  return (
    <div
      data-testid="cookie-modal-backdrop"
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSettings();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-silver-200">
          <h2 id="cookie-settings-title" className="font-display text-lg font-bold text-navy-900">
            Cookie settings
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSettings}
            aria-label="Close cookie settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-silver-500 hover:text-navy-900 hover:bg-silver-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
          >
            &#10005;
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="consent-essential" className="font-semibold text-navy-900 text-sm">
                Essential
              </label>
              <p className="text-silver-600 text-xs mt-1 leading-relaxed">
                Required for the site to work: your quote, booking request, secure payment and session. Always on.
              </p>
            </div>
            <Toggle id="consent-essential" checked disabled />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="consent-analytics" className="font-semibold text-navy-900 text-sm">
                Analytics
              </label>
              <p className="text-silver-600 text-xs mt-1 leading-relaxed">
                Helps us understand how visitors use the site, so we can improve it.
              </p>
            </div>
            <Toggle
              id="consent-analytics"
              checked={draft.analytics}
              onChange={(value) => setDraft((d) => ({ ...d, analytics: value }))}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="consent-advertising" className="font-semibold text-navy-900 text-sm">
                Advertising
              </label>
              <p className="text-silver-600 text-xs mt-1 leading-relaxed">
                Lets Google measure and improve the relevance of our adverts. See our{' '}
                <Link to="/privacy-policy#cookies" className="text-royal-600 underline">
                  Privacy Policy
                </Link>{' '}
                for details.
              </p>
            </div>
            <Toggle
              id="consent-advertising"
              checked={draft.advertising}
              onChange={(value) => setDraft((d) => ({ ...d, advertising: value }))}
            />
          </div>
        </div>

        <div className="px-6 py-5 border-t border-silver-200 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => saveChoices(draft)}
            className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white bg-navy-900 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
          >
            Save choices
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={rejectOptional}
              className="flex-1 min-h-[44px] px-4 rounded-lg text-sm font-semibold text-navy-900 bg-white border-2 border-navy-900 hover:bg-silver-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
            >
              Reject optional
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="flex-1 min-h-[44px] px-4 rounded-lg text-sm font-semibold text-navy-900 bg-white border-2 border-navy-900 hover:bg-silver-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
