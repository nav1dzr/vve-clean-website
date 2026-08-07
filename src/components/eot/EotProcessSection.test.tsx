import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EotProcessSection from './EotProcessSection';
import { EOT_GUARANTEE_HOURS } from '../../data/pricing';

describe('EotProcessSection', () => {
  it('renders all five numbered steps in order', () => {
    render(<EotProcessSection />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('Arrival & walkthrough');
    expect(items[4]).toHaveTextContent(`${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`);
  });

  it('states the real, published guarantee hours rather than a hardcoded number', () => {
    render(<EotProcessSection />);
    expect(screen.getByText(`${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`)).toBeInTheDocument();
  });

  it('mentions the 67-point checklist and free appliance cleaning, both already published elsewhere', () => {
    render(<EotProcessSection />);
    expect(screen.getByText(/67-point agency checklist/)).toBeInTheDocument();
    expect(screen.getByText('Appliances, included free')).toBeInTheDocument();
  });
});
