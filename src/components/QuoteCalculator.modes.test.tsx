import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuoteCalculator from './QuoteCalculator';
import { BookingProvider, useBookingCtx } from '../context/BookingContext';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function renderCalc(mode: 'carpet' | 'upholstery' | 'all-services') {
  return render(
    <MemoryRouter>
      <BookingProvider>
        <QuoteCalculator mode={mode} />
      </BookingProvider>
    </MemoryRouter>,
  );
}

describe('QuoteCalculator focused modes — reuse, no duplicated pricing logic', () => {
  it('carpet mode leads with carpets and offers upholstery as an optional add-on', () => {
    renderCalc('carpet');

    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
    expect(screen.getByText('Bedroom')).toBeInTheDocument();
    expect(screen.getByText('Hallway')).toBeInTheDocument();

    // Upholstery is offered inside the same quote rather than sending the
    // customer to a different calculator — framed as optional, not as a
    // second service the customer has to switch to. The offer is visible from
    // the start; its item controls stay collapsed until the customer says yes,
    // so the calculator does not open at full length.
    expect(screen.getByText('Would you also like upholstery cleaning?')).toBeInTheDocument();
    expect(screen.queryByText('2-seater sofa')).not.toBeInTheDocument();
    expect(screen.queryByText('Mattress (double/king)')).not.toBeInTheDocument();
  });

  it('upholstery mode leads with sofas, offers carpets, and hides the Service Type switcher', () => {
    renderCalc('upholstery');

    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
    expect(screen.getByText('2-seater sofa')).toBeInTheDocument();
    expect(screen.getByText('Armchair')).toBeInTheDocument();

    // Reciprocal offer — same pattern, opposite direction.
    expect(screen.getByText('Would you also like carpet cleaning?')).toBeInTheDocument();
    expect(screen.queryByText('Bedroom')).not.toBeInTheDocument();
    expect(screen.queryByText('Hallway')).not.toBeInTheDocument();
  });

  it('all-services mode still shows the full switcher and every item group', () => {
    renderCalc('all-services');

    expect(screen.getByText('Service Type')).toBeInTheDocument();
    expect(screen.getByText('Bedroom')).toBeInTheDocument();
    expect(screen.getByText('2-seater sofa')).toBeInTheDocument();
  });
});

function StickyStateProbe() {
  const { state } = useBookingCtx();
  return <output data-testid="sticky-state">{state}</output>;
}

describe('QuoteCalculator mobile-dock lifecycle', () => {
  it('resets the shared dock state when the calculator unmounts', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <BookingProvider>
          <QuoteCalculator mode="eot" />
          <StickyStateProbe />
        </BookingProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('sticky-state')).toHaveTextContent('hidden'));

    rerender(
      <MemoryRouter>
        <BookingProvider>
          <StickyStateProbe />
        </BookingProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('sticky-state')).toHaveTextContent('none'));
  });
});
