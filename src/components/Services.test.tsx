import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Services from './Services';

describe('Homepage service destinations', () => {
  it('gives each main service its own quote route, including the builders enquiry', () => {
    render(<MemoryRouter><Services onChoose={vi.fn()} /></MemoryRouter>);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(4);
    const builders = cards.find(card => within(card).queryByRole('heading', { name: 'After builders cleaning' }));
    expect(builders).toBeDefined();
    expect(within(builders!).getByRole('link', { name: /Get my cleaning quote/ }))
      .toHaveAttribute('href', '/after-builders-cleaning-london#builders-quote');
    expect(within(builders!).getByText('Budget guide · fixed written quote')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Build my estimate/ }).map(link => link.getAttribute('href')))
      .toEqual(['/carpet-cleaning-london#quote', '/sofa-cleaning-london#quote', '/end-of-tenancy-cleaning-london#quote']);
  });
});
