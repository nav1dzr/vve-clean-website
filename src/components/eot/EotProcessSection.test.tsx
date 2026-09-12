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
    expect(items[4]).toHaveTextContent(`${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee`);
  });

  it('states the real, published guarantee hours rather than a hardcoded number', () => {
    render(<EotProcessSection />);
    expect(screen.getByText(`${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee`)).toBeInTheDocument();
  });

  it('distinguishes included kitchen work from selected interiors without claiming a numbered agency checklist', () => {
    render(<EotProcessSection />);
    expect(screen.queryByText(/67-point|same standard letting agents|nothing gets missed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/oven, hob, grill and extractor are included in both packages/i)).toBeInTheDocument();
    expect(screen.getByText(/Tailored includes those you select/i)).toBeInTheDocument();
  });
});
