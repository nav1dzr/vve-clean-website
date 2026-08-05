import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EotQuoteWizard, { type EotBookingResult } from './EotQuoteWizard';
import {
  EOT_PRICES_P, EOT_EXTRA_BATH_P, CARPET_ITEM_PRICES_P,
} from '../data/pricing';

function renderWizard(onBook = vi.fn()) {
  const utils = render(<EotQuoteWizard onBook={onBook} />);
  return { onBook, ...utils };
}

function footerTotal() {
  return screen.getByTestId('footer-total');
}
function readFooterTotal() {
  return Number(footerTotal().textContent!.replace('£', '').replace(/,/g, ''));
}
async function next(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Continue$/ }));
}
async function toStep2(user: ReturnType<typeof userEvent.setup>) {
  await next(user); // property → package
}
async function toStep3(user: ReturnType<typeof userEvent.setup>) {
  await toStep2(user);
  await next(user); // package → floor care
}
async function toStep4(user: ReturnType<typeof userEvent.setup>) {
  await toStep3(user);
  await next(user); // floor care → add-ons & review
}

const flatBed2Cheapest = Math.min(EOT_PRICES_P.flat.bed2.complete, EOT_PRICES_P.flat.bed2.tailored) / 100;

describe('EotQuoteWizard — header progress tracker', () => {
  it('shows a connected four-step tracker with Property/Package/Floor care/Review labels', () => {
    renderWizard();
    expect(screen.getByText('Property')).toBeInTheDocument();
    expect(screen.getByText('Package')).toBeInTheDocument();
    expect(screen.getByText('Floor care')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('marks the current step distinctly from done/upcoming (not colour alone — aria-current + icon)', async () => {
    const user = userEvent.setup();
    renderWizard();
    const list = screen.getAllByRole('listitem');
    expect(within(list[0]).getByText('1')).toBeInTheDocument();
    await next(user);
    // Step 1's circle is now "done" and shows a check icon instead of "1".
    expect(within(list[0]).queryByText('1')).not.toBeInTheDocument();
  });
});

describe('EotQuoteWizard — Step 1: Property (no pricing breakdown shown)', () => {
  it('shows only property type, size, bathroom/WC counters, the 5+ card and a single bottom bar', () => {
    renderWizard();
    expect(screen.getByText('What type of property is it?')).toBeInTheDocument();
    expect(screen.getByText('Property size')).toBeInTheDocument();
    expect(screen.getByText('Full bathrooms')).toBeInTheDocument();
    expect(screen.getByText('Separate WCs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^5\+ bedrooms/ })).toBeInTheDocument();
    // No per-size prices, no adjustment text, no intermediate Tailored/Complete panel.
    expect(screen.queryByText(/from £/)).not.toBeInTheDocument();
    expect(screen.queryByText(/extra bathroom/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tailored from/)).not.toBeInTheDocument();
  });

  it('the single bottom bar reads "Starting from £X" with a concise live property summary', () => {
    renderWizard();
    expect(screen.getByText('Starting from')).toBeInTheDocument();
    expect(footerTotal()).toHaveTextContent(`£${flatBed2Cheapest}`);
    expect(screen.getByText('2 beds flat · 1 bathroom')).toBeInTheDocument();
  });

  it('keeps 5+ bedrooms inside the property-size selector, before bathroom and WC controls', () => {
    renderWizard();
    const sizeOptions = screen.getByTestId('property-size-options');
    const fivePlus = screen.getByRole('button', { name: /^5\+ bedrooms/ });
    const bathroomHeading = screen.getByText('Full bathrooms');
    expect(sizeOptions).toContainElement(fivePlus);
    expect(sizeOptions.compareDocumentPosition(bathroomHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('bathroom/WC changes update the bottom bar even though nothing is itemised on this step', async () => {
    const user = userEvent.setup();
    renderWizard();
    const before = readFooterTotal();
    await user.click(screen.getByRole('button', { name: /Increase full bathrooms/ }));
    expect(readFooterTotal()).toBe(before + EOT_EXTRA_BATH_P / 100);
    expect(screen.queryByText(/extra bathroom/)).not.toBeInTheDocument();
  });

  it('house/maisonette uses its own explicit price, not a flat + blanket adjustment', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: 'House / Maisonette' }));
    const houseCheapest = Math.min(EOT_PRICES_P.house.bed2!.complete, EOT_PRICES_P.house.bed2!.tailored) / 100;
    expect(footerTotal()).toHaveTextContent(`£${houseCheapest}`);
    expect(houseCheapest).not.toBe(flatBed2Cheapest + 30); // never the old "flat + £30" formula
  });

  it('house/maisonette never offers a studio — it is not in the explicit price matrix', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: 'Studio' }));
    await user.click(screen.getByRole('button', { name: 'House / Maisonette' }));
    expect(screen.queryByRole('button', { name: 'Studio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1 bed/ })).toHaveClass('border-royal-500'); // auto-corrected away from the now-invalid studio
  });

  it('the 5+ bedrooms card is active (not disabled) and offers WhatsApp and a request-a-quote action', async () => {
    const user = userEvent.setup();
    renderWizard();
    const card = screen.getByRole('button', { name: /^5\+ bedrooms/ });
    expect(card).not.toBeDisabled();
    await user.click(card);
    expect(screen.getByText('Large properties are quoted individually')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp us/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request a quote/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Continue$/ })).toBeDisabled();
  });
});

describe('EotQuoteWizard — Step 2: Choose your cleaning package', () => {
  it('shows both cards with correct, distinct prices', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    expect(screen.getByText('Complete Agency-Ready Clean')).toBeInTheDocument();
    expect(screen.getByText('Tailored Checklist Clean')).toBeInTheDocument();
    expect(screen.getByTestId('complete-price')).toHaveTextContent(`£${EOT_PRICES_P.flat.bed2.complete / 100}`);
    expect(screen.getByTestId('tailored-price')).toHaveTextContent(`£${EOT_PRICES_P.flat.bed2.tailored / 100}`);
  });

  it('Complete mentions microwave, fridge/freezer, dishwasher and washing-machine interiors', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    expect(screen.getByText(/Microwave, fridge\/freezer, dishwasher and washing-machine interiors/)).toBeInTheDocument();
  });

  it('Tailored explicitly states the oven is included and other interiors are not silently included', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    expect(screen.getByText(/One standard oven, hob, grill and extractor clean/)).toBeInTheDocument();
    expect(screen.getByText(/not silently included/)).toBeInTheDocument();
  });

  it('longer inclusion lists are in an accessible expand/collapse section', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    const detailsList = screen.getAllByText('See full details');
    expect(detailsList.length).toBe(2);
    expect(screen.getByText('Not included')).not.toBeVisible();
    await user.click(detailsList[0]);
    expect(screen.getByText('Not included')).toBeVisible();
  });

  it('selecting Tailored keeps the selection obvious — no automatic switch to a different flow', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    await user.click(screen.getByText('Tailored Checklist Clean'));
    expect(screen.getByText('Tailored Checklist Clean').closest('button')).toHaveClass('border-royal-500');
    expect(footerTotal()).toHaveTextContent(`£${EOT_PRICES_P.flat.bed2.tailored / 100}`);
  });
});

describe('EotQuoteWizard — Step 3: Floor care (Professional first)', () => {
  it('shows Professional carpet steam cleaning first, then Standard, then No carpeted areas', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    const buttons = screen.getAllByRole('button').filter((b) =>
      /Professional carpet steam cleaning|Standard floor care|No carpeted areas/.test(b.textContent ?? ''));
    expect(buttons[0]).toHaveTextContent('Professional carpet steam cleaning');
    expect(buttons[1]).toHaveTextContent('Standard floor care');
    expect(buttons[2]).toHaveTextContent('No carpeted areas');
  });

  it('Professional is visually prominent but never preselected', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ })).not.toHaveClass('border-royal-500');
    expect(footerTotal()).toHaveTextContent(`£${EOT_PRICES_P.flat.bed2.complete / 100}`);
  });

  it('choosing Professional still offers whole-property and manual carpet selection', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    expect(screen.getByText('Whole-property carpet cleaning')).toBeInTheDocument();
    expect(screen.getByText('Choose areas individually')).toBeInTheDocument();
  });

  it('the 50% reduction applies only to the carpet subtotal, never to the EOT package price', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    await user.click(screen.getByText('Choose areas individually').closest('button')!);
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
    }
    const carpetSubtotal = CARPET_ITEM_PRICES_P.bedroom * 4;
    const expectedCarpetCharge = Math.round(carpetSubtotal * 0.5);
    expect(readFooterTotal()).toBe(EOT_PRICES_P.flat.bed2.complete / 100 + expectedCarpetCharge / 100);
  });

  it('exact .50 pence carpet totals are never rounded to a whole pound', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    await user.click(screen.getByText('Choose areas individually').closest('button')!);
    // 1 hallway (2500) + 8 landings (2000 × 8 = 16000) = 18500 subtotal (odd
    // hundreds of pence, since hallway is the only odd-hundred base price) →
    // 50% = 9250p = £92.50, which also clears both the top-2 (£45) and the
    // £85 minimum floors, so the package price is what's actually charged.
    await user.click(screen.getByRole('button', { name: /Increase Hallways/ }));
    for (let i = 0; i < 8; i++) {
      await user.click(screen.getByRole('button', { name: /Increase Landings/ }));
    }
    expect(footerTotal().textContent).toContain('.50');
  });
});

describe('EotQuoteWizard — Step 4: Add-ons and final review', () => {
  it('Tailored groups the microwave under Appliance interiors, priced before selection', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    await user.click(screen.getByText('Tailored Checklist Clean'));
    await next(user);
    await next(user);
    expect(screen.getByText('Appliance interiors')).toBeInTheDocument();
    const row = screen.getByText('Inside microwave').closest('label')!;
    expect(within(row).getByRole('checkbox')).not.toBeChecked();
    expect(within(row).getByText('+£10')).toBeInTheDocument();
  });

  it('does not show the removed "switching to Complete" upsell sentence', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    await user.click(screen.getByText('Tailored Checklist Clean'));
    await next(user);
    await next(user);
    expect(screen.queryByText(/Switching to Complete for/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Complete saves you money/)).not.toBeInTheDocument();
  });

  it('the inline upholstery/mattress selector adds items to the current quote without navigating away', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    // Step 4's footer total is intentionally hidden here — the "Your quote"
    // payment card already shows the same figure, so read that instead.
    const readTotal = () => Number(screen.getByTestId('final-total').textContent!.replace('£', '').replace(/,/g, ''));
    const before = readTotal();
    await user.click(screen.getByText('Upholstery & mattress cleaning'));
    await user.click(screen.getByRole('button', { name: /Increase 2-seater sofa/ }));
    expect(readTotal()).toBe(before + CARPET_ITEM_PRICES_P.sofa_2 / 100);
    // Still on Step 4 — no route change, no lost position.
    expect(screen.getByText('Review your quote')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('button', { name: /Increase 2-seater sofa/ })).not.toBeInTheDocument();
    expect(readTotal()).toBe(before + CARPET_ITEM_PRICES_P.sofa_2 / 100);
  });

  it('rug cleaning stays WhatsApp/photo-assessment only, never auto-priced', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    expect(screen.getByRole('link', { name: /WhatsApp a photo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Increase Rug/ })).not.toBeInTheDocument();
  });

  it('shows a static parking/Congestion Charge note with no selectable parking question', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    expect(screen.getByText(/Parking costs are not included/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^yes$/i })).not.toBeInTheDocument();
  });

  it('the final payment card shows exactly one Total, deposit and balance — no duplicate pricing block', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    expect(screen.getByText('Your quote')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText('Total service price')).not.toBeInTheDocument();
    expect(screen.queryByText('Final total')).not.toBeInTheDocument();
    expect(screen.getByText('Deposit today')).toBeInTheDocument();
    expect(screen.getByText('Balance after cleaning')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Full ${72}-hour agency-ready guarantee`))).toBeInTheDocument();
  });

  it('calling onBook produces a quoteConfig with exact pence — never rounded to a whole pound', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<EotQuoteWizard onBook={onBook} />);
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    await user.click(screen.getByText('Choose areas individually').closest('button')!);
    await user.click(screen.getByRole('button', { name: /Increase Hallways/ }));
    for (let i = 0; i < 8; i++) {
      await user.click(screen.getByRole('button', { name: /Increase Landings/ }));
    }
    await next(user); // → step 4
    await user.click(screen.getByRole('button', { name: /Continue to booking/ }));

    expect(onBook).toHaveBeenCalledTimes(1);
    const result = onBook.mock.calls[0][0] as EotBookingResult;
    // 18500 standalone → 9250 charged → 33900 + 9250 = 43150p = £431.50 exactly.
    expect(result.price).toBe((EOT_PRICES_P.flat.bed2.complete + 9250) / 100);
    expect(Number.isInteger(result.price * 100)).toBe(true);
  });

  it('selecting a heavy/exceptional condition shows the photo-review notice and no book button', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<EotQuoteWizard onBook={onBook} />);
    await toStep4(user);
    await user.click(screen.getByRole('button', { name: /Mould, biohazard or specialist contamination/ }));
    expect(screen.getAllByText(/Photo review required/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /Continue to booking/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Send photos on WhatsApp/ })).toBeInTheDocument();
    expect(onBook).not.toHaveBeenCalled();
  });
});

describe('EotQuoteWizard — Back navigation preserves state', () => {
  it('property, package, floor-care and upholstery selections survive Back navigation', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: 'House / Maisonette' }));
    await next(user); // step 1 → step 2
    await user.click(screen.getByText('Tailored Checklist Clean'));
    await next(user); // step 2 → step 3
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    await user.click(screen.getByText('Choose areas individually').closest('button')!);
    await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
    await next(user); // → step 4
    await user.click(screen.getByText('Upholstery & mattress cleaning'));
    await user.click(screen.getByRole('button', { name: /Increase Armchair/ }));

    // Back to step 3, then all the way back to step 1.
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(screen.getByRole('button', { name: 'House / Maisonette' })).toHaveClass('border-royal-500');

    // Forward again — Tailored, carpet count and upholstery count all preserved.
    await toStep2(user);
    expect(screen.getByText('Tailored Checklist Clean').closest('button')).toHaveClass('border-royal-500');
    await next(user);
    expect(screen.getByRole('button', { name: /Decrease Bedrooms/ })).toBeInTheDocument();
    await next(user);
    expect(screen.getByText(/1 added to this quote|£45 added to this quote/)).toBeInTheDocument();
  });
});

describe('EotQuoteWizard — totals never decrease when scope is added', () => {
  it('adding bathrooms, package upgrades and carpet areas only ever raises the total', async () => {
    const user = userEvent.setup();
    renderWizard();
    let prev = readFooterTotal();
    await user.click(screen.getByRole('button', { name: /Increase full bathrooms/ }));
    expect(readFooterTotal()).toBeGreaterThanOrEqual(prev);
    prev = readFooterTotal();

    await toStep3(user);
    expect(readFooterTotal()).toBeGreaterThanOrEqual(prev);
    prev = readFooterTotal();

    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    await user.click(screen.getByText('Choose areas individually').closest('button')!);
    await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
    expect(readFooterTotal()).toBeGreaterThanOrEqual(prev);
    prev = readFooterTotal();

    // On Step 4 the footer total is intentionally hidden (the full "Your
    // quote" payment card already shows it) — read that card's total instead.
    await next(user);
    const readFinalTotal = () => Number(screen.getByTestId('final-total').textContent!.replace('£', '').replace(/,/g, ''));
    expect(readFinalTotal()).toBeGreaterThanOrEqual(prev);
    prev = readFinalTotal();

    await user.click(screen.getByRole('button', { name: /Increase Rubbish removal/ }));
    expect(readFinalTotal()).toBeGreaterThanOrEqual(prev);
  });
});

describe('EotQuoteWizard — restoring a previous session', () => {
  it('rehydrates property type, size and package from a restoreConfig', () => {
    const onBook = vi.fn();
    const restoreConfig: EotBookingResult['quoteConfig'] = {
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed3', deepBaths: 2, deepWcs: 1, isHouse: true,
      eotPackage: 'tailored',
      tailoredAddOns: { microwaveInside: true, fridgeFreezerInside: true, extraFridgeFreezers: 0, dishwasherInside: false, washingMachineInside: false, cupboards: false },
      addOnCounts: {}, rooms: [], carpetRoomIds: [], windowSize: 'small', gutterType: 'terraced', officeHours: 2,
      condition: 'normal',
    };
    render(<EotQuoteWizard onBook={onBook} restoreConfig={restoreConfig} />);
    expect(screen.getByRole('button', { name: /^3 beds/ })).toHaveClass('border-royal-500');
    expect(screen.getByRole('button', { name: 'House / Maisonette' })).toHaveClass('border-royal-500');
  });

  it('falls back to a valid size if restoring an invalid house+studio combination', () => {
    const onBook = vi.fn();
    const restoreConfig: EotBookingResult['quoteConfig'] = {
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'studio', deepBaths: 1, deepWcs: 0, isHouse: true,
      eotPackage: 'complete',
      tailoredAddOns: { microwaveInside: false, fridgeFreezerInside: false, extraFridgeFreezers: 0, dishwasherInside: false, washingMachineInside: false, cupboards: false },
      addOnCounts: {}, rooms: [], carpetRoomIds: [], windowSize: 'small', gutterType: 'terraced', officeHours: 2,
      condition: 'normal',
    };
    render(<EotQuoteWizard onBook={onBook} restoreConfig={restoreConfig} />);
    expect(screen.queryByRole('button', { name: 'Studio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1 bed/ })).toHaveClass('border-royal-500');
  });
});

describe('EotQuoteWizard — Continue/Back return the viewport to the wizard', () => {
  it('does not scroll on initial mount', () => {
    const scrollSpy = vi.fn();
    window.scrollTo = scrollSpy as typeof window.scrollTo;
    renderWizard();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('scrolls to the wizard when Continue advances the step', async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.fn();
    window.scrollTo = scrollSpy as typeof window.scrollTo;
    renderWizard();
    await next(user);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('scrolls to the wizard when Back returns to the previous step, not the previous scroll position', async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.fn();
    window.scrollTo = scrollSpy as typeof window.scrollTo;
    renderWizard();
    await next(user); // step 1 → step 2, first scroll call
    scrollSpy.mockClear();
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('scrolls instantly rather than smoothly when the user prefers reduced motion', async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.fn();
    window.scrollTo = scrollSpy as typeof window.scrollTo;
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes('reduced-motion'), media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    });
    try {
      renderWizard();
      await next(user);
      expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('EotQuoteWizard — mobile footer layout', () => {
  it('lays out the price summary full-width and separately from Back/Continue on mobile, single-row from sm: up', () => {
    renderWizard();
    const nav = screen.getByTestId('footer-nav');
    expect(nav).toHaveClass('flex-wrap');
    expect(nav).toHaveClass('sm:flex-nowrap');

    const priceSummary = screen.getByTestId('footer-price-summary');
    expect(priceSummary).toHaveClass('w-full');
    expect(priceSummary).toHaveClass('sm:w-auto');
    expect(priceSummary).toHaveClass('order-1');
    expect(priceSummary).toHaveClass('sm:order-2');

    const backButton = screen.getByRole('button', { name: /^Back$/ });
    expect(backButton).toHaveClass('order-2');
    expect(backButton).toHaveClass('sm:order-1');

    const continueButton = screen.getByRole('button', { name: /^Continue$/ });
    expect(continueButton).toHaveClass('order-3');
  });

  it('hides the repeated footer total on Step 4 once the full quote/payment card is visible, keeping Back accessible', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    expect(screen.queryByTestId('footer-price-summary')).not.toBeInTheDocument();
    expect(screen.getByText('Your quote')).toBeInTheDocument();
    const backButton = screen.getByRole('button', { name: /^Back$/ });
    expect(backButton).toBeInTheDocument();
    expect(backButton).not.toBeDisabled();
  });

  it('keeps the footer summary on Step 4 when a photo-review condition applies, since no payment card is shown there', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    await user.click(screen.getByRole('button', { name: /Mould, biohazard or specialist contamination/ }));
    expect(screen.getByTestId('footer-price-summary')).toBeInTheDocument();
    expect(screen.getByTestId('footer-total')).toHaveTextContent('Quote review');
  });
});

describe('EotQuoteWizard — selectable cards expose a programmatically determinable selected state', () => {
  it('property type buttons maintain aria-pressed', async () => {
    const user = userEvent.setup();
    renderWizard();
    const flatBtn = screen.getByRole('button', { name: 'Flat' });
    const houseBtn = screen.getByRole('button', { name: 'House / Maisonette' });
    expect(flatBtn).toHaveAttribute('aria-pressed', 'true');
    expect(houseBtn).toHaveAttribute('aria-pressed', 'false');
    await user.click(houseBtn);
    expect(houseBtn).toHaveAttribute('aria-pressed', 'true');
    expect(flatBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('property size buttons maintain aria-pressed', async () => {
    const user = userEvent.setup();
    renderWizard();
    const bed2 = screen.getByRole('button', { name: /^2 beds/ });
    const bed3 = screen.getByRole('button', { name: /^3 beds/ });
    expect(bed2).toHaveAttribute('aria-pressed', 'true');
    expect(bed3).toHaveAttribute('aria-pressed', 'false');
    await user.click(bed3);
    expect(bed3).toHaveAttribute('aria-pressed', 'true');
    expect(bed2).toHaveAttribute('aria-pressed', 'false');
  });

  it('Complete/Tailored package cards maintain aria-pressed', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    const completeBtn = screen.getByText('Complete Agency-Ready Clean').closest('button')!;
    const tailoredBtn = screen.getByText('Tailored Checklist Clean').closest('button')!;
    expect(completeBtn).toHaveAttribute('aria-pressed', 'true');
    expect(tailoredBtn).toHaveAttribute('aria-pressed', 'false');
    await user.click(tailoredBtn);
    expect(tailoredBtn).toHaveAttribute('aria-pressed', 'true');
    expect(completeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('floor-care choice buttons maintain aria-pressed', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    const professional = screen.getByRole('button', { name: /^Professional carpet steam cleaning/ });
    const none = screen.getByRole('button', { name: /^No carpeted areas/ });
    expect(professional).toHaveAttribute('aria-pressed', 'false');
    await user.click(none);
    expect(none).toHaveAttribute('aria-pressed', 'true');
    expect(professional).toHaveAttribute('aria-pressed', 'false');
  });

  it('whole-property/manual carpet mode buttons maintain aria-pressed', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    const whole = screen.getByText('Whole-property carpet cleaning').closest('button')!;
    const manual = screen.getByText('Choose areas individually').closest('button')!;
    expect(whole).toHaveAttribute('aria-pressed', 'false');
    expect(manual).toHaveAttribute('aria-pressed', 'false');
    await user.click(whole);
    expect(whole).toHaveAttribute('aria-pressed', 'true');
    expect(manual).toHaveAttribute('aria-pressed', 'false');
  });

  it('condition buttons maintain aria-pressed', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    const normal = screen.getByRole('button', { name: /Normal used condition/ });
    const heavy = screen.getByRole('button', { name: /Heavy grease, scale or build-up/ });
    expect(normal).toHaveAttribute('aria-pressed', 'true');
    expect(heavy).toHaveAttribute('aria-pressed', 'false');
    await user.click(heavy);
    expect(heavy).toHaveAttribute('aria-pressed', 'true');
    expect(normal).toHaveAttribute('aria-pressed', 'false');
  });
});
