import { createContext, useContext, useState } from 'react';

export type StickyState = 'none' | 'bookable' | 'manual';

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
