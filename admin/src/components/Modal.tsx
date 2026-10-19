import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

// Compact modal/drawer: bottom sheet on mobile, centred card on desktop.
// Escape closes it; focus moves into the panel and returns to the opener
// on close when that element is still present.
export default function Modal({ titleId, title, onClose, children, wide = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose reachable from the mount-only effect below
  // without making it a dependency — onClose is a fresh function on every
  // parent re-render (e.g. every keystroke in a controlled textarea), and
  // re-running this effect on each of those would re-steal focus away from
  // whatever the user is actively typing into.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusableEls = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
      );
      if (focusableEls.length === 0) return;
      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      const active = document.activeElement;
      if (active === panelRef.current || !panelRef.current.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);

    // Deliberately excludes plain <button> from the initial-focus search —
    // a modal's own close (✕) button is typically the first focusable
    // element in DOM order, but jumping into the actual form field (if any)
    // is more useful. Falls back to the panel itself when there is no
    // input/textarea/select to focus.
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
    );
    (focusable || panelRef.current)?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-navy-950/40 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg outline-none sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="font-semibold text-navy-950">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy-700 hover:bg-silver-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
