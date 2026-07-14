import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Compact modal/drawer: bottom sheet on mobile, centred card on desktop.
// Escape closes it; focus moves into the panel on open. Returning focus to
// the element that opened the modal is the caller's responsibility (pass a
// ref to the trigger and call .focus() on it inside onClose) — this keeps
// the modal itself simple and reusable rather than assuming one trigger
// shape.
export default function Modal({ titleId, title, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose reachable from the mount-only effect below
  // without making it a dependency — onClose is a fresh function on every
  // parent re-render (e.g. every keystroke in a controlled textarea), and
  // re-running this effect on each of those would re-steal focus away from
  // whatever the user is actively typing into.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusableEls = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusableEls.length === 0) return;
      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
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
      'input, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    (focusable || panelRef.current)?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
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
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg outline-none sm:max-w-md sm:rounded-2xl sm:p-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="font-semibold text-navy-950">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-navy-700 hover:bg-silver-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
