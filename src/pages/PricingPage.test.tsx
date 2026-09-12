import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PricingPage from './PricingPage';

vi.mock('../components/Navbar', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/GoogleBadge', () => ({ default: () => null }));
vi.mock('../components/FaqSchema', () => ({ default: () => null }));

function renderPricing() {
  return render(<MemoryRouter><PricingPage /></MemoryRouter>);
}

describe('PricingPage — current service prices and meaningful comparisons', () => {
  it('leads with Complete flat prices and keeps selected-task prices clearly separate', async () => {
    const user = userEvent.setup();
    renderPricing();
    const panel = screen.getByRole('heading', { name: 'End of tenancy cleaning' }).parentElement!;
    const completeRows = within(panel.querySelector('dl')!).getAllByRole('definition');
    expect(completeRows.map(row => row.textContent)).toEqual(['£220', '£279', '£339', '£409', '£529']);
    expect(within(panel).getByText(/vacant, normally maintained flat with one bathroom/)).toBeVisible();
    expect(within(panel).getByText('Studio flat — Tailored from')).not.toBeVisible();
    await user.click(screen.getByText('Only need selected tasks? Compare Tailored'));
    const tailoredDetails = screen.getByText('Only need selected tasks? Compare Tailored').closest('details')!;
    expect(within(tailoredDetails).getAllByRole('definition').map(row => row.textContent)).toEqual(['£159', '£199', '£259', '£319', '£419']);
    expect(tailoredDetails).toHaveTextContent('optional additions');
    expect(panel).not.toHaveTextContent('67-point');
  });

  it('compares the actual EOT carpet add-on with the standalone bundle total', async () => {
    const user = userEvent.setup();
    renderPricing();
    await user.click(screen.getByText('Add professional carpet cleaning'));
    const details = screen.getByText('Add professional carpet cleaning').closest('details')!;
    expect(details).toHaveTextContent('£110 added to your EOT clean');
    expect(details).toHaveTextContent('standalone booking for those areas is £125');
    expect(details).toHaveTextContent('saving of £15');
    expect(details).toHaveTextContent('£85 carpet minimum');
    expect(details).not.toHaveTextContent('50%');
  });

  it('shows the upholstery visit minimum beside item prices and keeps the next action on that service', async () => {
    const user = userEvent.setup();
    renderPricing();
    await user.click(screen.getByRole('button', { name: 'Sofas & upholstery' }));
    const panel = screen.getByRole('heading', { name: 'Sofas & upholstery' }).parentElement!;
    expect(panel).toHaveTextContent('£85 minimum per visit');
    expect(within(panel).getByText('2-seater sofa').parentElement).toHaveTextContent('£70');
    expect(screen.getByRole('link', { name: 'Get my price' })).toHaveAttribute('href', '/sofa-cleaning-london#quote');
    await user.click(screen.getByRole('button', { name: 'Carpets' }));
    expect(screen.getByRole('link', { name: 'Get my price' })).toHaveAttribute('href', '/carpet-cleaning-london#quote');
    expect(screen.getByRole('heading', { name: 'Carpet cleaning' }).parentElement).toHaveTextContent('£85 minimum per visit');
  });
});
