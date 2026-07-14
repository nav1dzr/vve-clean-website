import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ACCEPT_ALL_CATEGORIES,
  REJECT_OPTIONAL_CATEGORIES,
  applyConsentToGtag,
  getStoredConsent,
  saveConsent,
  type ConsentCategories,
  type ConsentChoice,
} from '../lib/consent';
import CookieConsentBanner from '../components/CookieConsentBanner';
import CookieSettingsModal from '../components/CookieSettingsModal';

interface CookieConsentContextValue {
  ready: boolean;
  decided: boolean;
  categories: ConsentCategories;
  bannerVisible: boolean;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  acceptAll: () => void;
  rejectOptional: () => void;
  saveChoices: (categories: ConsentCategories) => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  // Starts unready/undecided on both server and first client render (no
  // localStorage read during render) to avoid an SSR/hydration mismatch —
  // the real state loads a tick later in the effect below.
  const [ready, setReady] = useState(false);
  const [decided, setDecided] = useState(false);
  const [categories, setCategories] = useState<ConsentCategories>(REJECT_OPTIONAL_CATEGORIES);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) {
      const next = { analytics: stored.analytics, advertising: stored.advertising };
      setCategories(next);
      setDecided(true);
      // index.html/confirmation.html already apply any stored choice before
      // the app hydrates; this is a harmless, idempotent re-application in
      // case gtag finished loading after that inline script ran.
      applyConsentToGtag(next);
    }
    setReady(true);
  }, []);

  const commit = useCallback((next: ConsentCategories, choice: ConsentChoice) => {
    saveConsent(next, choice);
    applyConsentToGtag(next);
    setCategories(next);
    setDecided(true);
    setSettingsOpen(false);
  }, []);

  const acceptAll = useCallback(() => commit(ACCEPT_ALL_CATEGORIES, 'accepted_all'), [commit]);
  const rejectOptional = useCallback(() => commit(REJECT_OPTIONAL_CATEGORIES, 'rejected_optional'), [commit]);
  const saveChoices = useCallback((next: ConsentCategories) => commit(next, 'custom'), [commit]);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const value: CookieConsentContextValue = {
    ready,
    decided,
    categories,
    bannerVisible: ready && !decided && !settingsOpen,
    settingsOpen,
    openSettings,
    closeSettings,
    acceptAll,
    rejectOptional,
    saveChoices,
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {value.bannerVisible && <CookieConsentBanner />}
      {settingsOpen && <CookieSettingsModal />}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  return ctx;
}
