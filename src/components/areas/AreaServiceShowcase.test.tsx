import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AreaServiceShowcase from './AreaServiceShowcase';
import { AREAS_BY_SLUG } from '../../data/areas';

describe('AreaServiceShowcase', () => {
  it('uses reliable service icons instead of missing decorative image files', () => {
    render(
      <MemoryRouter>
        <AreaServiceShowcase area={AREAS_BY_SLUG.islington} />
      </MemoryRouter>,
    );

    const heading = screen.getByRole('heading', { name: /Three straightforward ways we can help in Islington/i });
    const section = heading.closest('section');
    expect(section).not.toBeNull();

    const cards = within(section as HTMLElement).getAllByRole('article').slice(0, 3);
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(within(card).queryByRole('img')).not.toBeInTheDocument();
    expect(within(cards[0]).getByText('End of tenancy cleaning')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Carpet cleaning')).toBeInTheDocument();
    expect(within(cards[2]).getByText('Sofa & upholstery')).toBeInTheDocument();
  });
});
