import { createContext, useContext, useState } from 'react';

// 'hidden' fully suppresses the site-wide mobile sticky footer. It exists for
// pages that render their own bottom bar (the EOT quote) and would otherwise
// stack two — or three, with the cookie banner — fixed bars on top of each
// other. 'none' deliberately still renders the footer, so no existing page
// changes behaviour.
export type StickyState = 'none' | 'bookable' | 'manual' | 'hidden';

export interface StickyBookingValue {
  state:  StickyState;
  price:  number;
  waLink: string;
  onBook: () => void;
}

interface FullCtx extends StickyBookingValue {
  setCtx: (v: StickyBookingValue) => void;
}

const noop = () => {};

const BookingContext = createContext<FullCtx>({
  state: 'none', price: 0, waLink: '', onBook: noop, setCtx: noop,
});

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [val, setVal] = useState<StickyBookingValue>({
    state: 'none', price: 0, waLink: '', onBook: noop,
  });
  return (
    <BookingContext.Provider value={{ ...val, setCtx: setVal }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBookingCtx() {
  return useContext(BookingContext);
}
