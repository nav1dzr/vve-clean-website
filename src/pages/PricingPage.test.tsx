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
  it('routes after-builders enquiries to an assessed guide rather than quoting a whole-home starting amount', async () => {
    const user = userEvent.setup();
    renderPricing();
    await user.click(screen.getByRole('button', { name: /^Other cleans/ }));
    const builders = screen.getByRole('heading', { name: 'After Builders Clean' }).parentElement!.parentElement!;
    expect(builders).toHaveTextContent('Assessed quote');
    expect(builders).toHaveTextContent('Budget ranges are guidance only');
    expect(builders).not.toHaveTextContent('£249');
    expect(within(builders).getByRole('link', { name: 'See the after-builders budget guide' })).toHaveAttribute('href', '/after-builders-cleaning-london#builders-prices');
    expect(within(builders).getByRole('link', { name: 'Tell us about your project' })).toHaveAttribute('href', '/after-builders-cleaning-london#builders-quote');
    await user.click(screen.getByText('Optional services and access costs'));
    expect(screen.getByText(/These listed extras apply/)).toHaveTextContent('not fixed after-builders add-on fees');
  });

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
    await user.click(screen.getByRole('button', { name: /^Sofas & upholstery/ }));
    const panel = screen.getByRole('heading', { name: 'Sofas & upholstery' }).parentElement!;
    expect(panel).toHaveTextContent('£85 minimum per visit');
    expect(within(panel).getByText('2-seater sofa').parentElement).toHaveTextContent('£70');
    expect(screen.getByRole('link', { name: 'Get my price' })).toHaveAttribute('href', '/sofa-cleaning-london#quote');
    await user.click(screen.getByRole('button', { name: /^Carpets/ }));
    expect(screen.getByRole('link', { name: 'Get my price' })).toHaveAttribute('href', '/carpet-cleaning-london#quote');
    expect(screen.getByRole('heading', { name: 'Carpet cleaning' }).parentElement).toHaveTextContent('£85 minimum per visit');
  });

  it('keeps included tenancy appliances out of priced extras and shows extras only for relevant services', async () => {
    const user = userEvent.setup();
    renderPricing();
    await user.click(screen.getByText('Optional services and access costs'));
    const extras = screen.getByText('Optional services and access costs').closest('details')!;
    expect(extras).toHaveTextContent('Oven, hob and extractor cleaning are included in both end of tenancy packages');
    expect(within(extras).getAllByRole('term').map(term => term.textContent)).toEqual(['Exterior windows', 'Wall marks & scuffs', 'Key collection/return', 'Rubbish removal (small load)']);
    expect(within(extras).queryByText('Oven, hob & extractor add-on')).not.toBeInTheDocument();
    expect(within(extras).queryByText('Inside fridge / freezer add-on')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Other cleans/ }));
    expect(within(extras).getByText('Oven, hob & extractor add-on').parentElement).toHaveTextContent('£35');
    expect(within(extras).getByText('Inside fridge / freezer add-on').parentElement).toHaveTextContent('£25');

    for (const category of [/^Carpets/, /^Sofas & upholstery/]) {
      await user.click(screen.getByRole('button', { name: category }));
      expect(extras).toHaveTextContent('Access costs and special requirements');
      expect(extras.querySelector('dl')).toBeNull();
      expect(extras).toHaveTextContent('Parking and any applicable Congestion Charge are shown separately and agreed with you');
    }
  });
});

describe('PricingPage — visible carpet and upholstery discount terms', () => {
  it('shows the existing item bands and minimum for both eligible services', async () => {
    const user = userEvent.setup();
    renderPricing();
    for (const [button, heading] of [[/^Carpets/, 'Carpet cleaning'], [/^Sofas & upholstery/, 'Sofas & upholstery']] as const) {
      await user.click(screen.getByRole('button', { name: button }));
      const panel = screen.getByRole('heading', { name: heading }).parentElement!;
      expect(panel).toHaveTextContent('£10 off 3+ eligible items, £20 off 5+ eligible items, £35 off 7+ eligible items');
      expect(panel).toHaveTextContent('Carpet and upholstery items can be combined');
      expect(panel).toHaveTextContent('£85 minimum per visit applies; offers are not combined');
    }
  });
});
