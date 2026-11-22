import { useEffect, useState } from 'react';

// London midnight and both arrival-window cutoffs fall on whole UTC hours,
// including on UK clock-change days. Refresh a sleeping tab when it returns.
export function useScheduleClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setTimeout(refresh, 3_600_000 - Date.now() % 3_600_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [now]);
  return now;
}
