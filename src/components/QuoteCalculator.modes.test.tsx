import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuoteCalculator from './QuoteCalculator';
import { BookingProvider } from '../context/BookingContext';

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
  it('carpet mode shows only carpet items and hides the Service Type switcher', () => {
    renderCalc('carpet');

    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
    expect(screen.getByText('Bedroom')).toBeInTheDocument();
    expect(screen.getByText('Hallway')).toBeInTheDocument();
    expect(screen.queryByText('2-seater sofa')).not.toBeInTheDocument();
    expect(screen.queryByText('Mattress (double/king)')).not.toBeInTheDocument();
  });

  it('upholstery mode shows only sofa/upholstery items and hides the Service Type switcher', () => {
    renderCalc('upholstery');

    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
    expect(screen.getByText('2-seater sofa')).toBeInTheDocument();
    expect(screen.getByText('Armchair')).toBeInTheDocument();
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
