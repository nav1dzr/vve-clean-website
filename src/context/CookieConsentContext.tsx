import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  CONSENT_STORAGE_KEY,
  ACCEPT_ALL_CATEGORIES,
  REJECT_OPTIONAL_CATEGORIES,
  applyConsentToGtag,
  getStoredConsent,
  saveConsent,
  type ConsentCategories,
  type ConsentChoice,
  type StoredConsent,
} from '../lib/consent';
import { setConsentRecord } from '../lib/attribution';
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

  const applyRecord = useCallback((record: StoredConsent | null) => {
    const next = record
      ? { analytics: record.analytics, advertising: record.advertising }
      : REJECT_OPTIONAL_CATEGORIES;
    // Publish synchronously; payloads must never mix a new choice with old proof.
    setConsentRecord(record);
    applyConsentToGtag(next);
    setCategories(next);
    setDecided(record !== null);
  }, []);

  useEffect(() => {
    applyRecord(getStoredConsent());
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== CONSENT_STORAGE_KEY) return;
      // Ignore sessionStorage events. A missing storageArea is allowed for
      // synthetic events; reading localStorage can itself fail in locked browsers.
      if (event.storageArea) {
        try { if (event.storageArea !== window.localStorage) return; }
        catch { applyRecord(null); return; }
      }
      applyRecord(getStoredConsent());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applyRecord]);

  const commit = useCallback((next: ConsentCategories, choice: ConsentChoice) => {
    // The explicit current-tab choice remains valid if persistence is blocked.
    applyRecord(saveConsent(next, choice));
    setSettingsOpen(false);
  }, [applyRecord]);

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
