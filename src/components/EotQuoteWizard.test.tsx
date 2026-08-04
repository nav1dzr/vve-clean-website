import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EotQuoteWizard, { type EotBookingResult } from './EotQuoteWizard';
import {
  EOT_COMPLETE_PRICES_P, EOT_TAILORED_START_PRICES_P, EOT_HOUSE_ADJUSTMENT_P, EOT_EXTRA_BATH_P,
  CARPET_ITEM_PRICES_P,
} from '../data/pricing';

function renderWizard(onBook = vi.fn()) {
  const utils = render(<EotQuoteWizard onBook={onBook} />);
  return { onBook, ...utils };
}

function footerTotal() {
  return screen.getByTestId('footer-total');
}
function readFooterTotal() {
  return Number(footerTotal().textContent!.replace('£', ''));
}
async function next(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Next$/ }));
}
async function toStep2(user: ReturnType<typeof userEvent.setup>) {
  await next(user); // property details → package
}
async function toStep3(user: ReturnType<typeof userEvent.setup>) {
  await toStep2(user);
  await next(user); // package → floor care
}
async function toStep4(user: ReturnType<typeof userEvent.setup>) {
  await toStep3(user);
  await next(user); // floor care → add-ons & review
}

describe('EotQuoteWizard — Step 1: Property details', () => {
  it('defaults to a 2-bed flat and shows the cheapest starting price', () => {
    renderWizard();
    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();
    const cheapest = Math.min(EOT_COMPLETE_PRICES_P.bed2, EOT_TAILORED_START_PRICES_P.bed2) / 100;
    expect(footerTotal()).toHaveTextContent(`£${cheapest}`);
    expect(screen.getAllByText('Starting from').length).toBeGreaterThanOrEqual(1);
  });

  it('selecting house adds the house/maisonette adjustment to the displayed price', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: 'House / Maisonette' }));
    expect(screen.getByText(new RegExp(`\\+£${EOT_HOUSE_ADJUSTMENT_P / 100} house/maisonette`))).toBeInTheDocument();
  });

  it('changing property size updates the starting-price footer total', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /^1 bed/ }));
    const cheapest = Math.min(EOT_COMPLETE_PRICES_P.bed1, EOT_TAILORED_START_PRICES_P.bed1) / 100;
    expect(footerTotal()).toHaveTextContent(`£${cheapest}`);
  });

  it('increasing full bathrooms adds the extra-bathroom charge to the starting price', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /Increase full bathrooms/ }));
    expect(screen.getByText(new RegExp(`\\+£${EOT_EXTRA_BATH_P / 100} for 1 extra bathroom`))).toBeInTheDocument();
    const cheapest = Math.min(EOT_COMPLETE_PRICES_P.bed2, EOT_TAILORED_START_PRICES_P.bed2) / 100 + EOT_EXTRA_BATH_P / 100;
    expect(footerTotal()).toHaveTextContent(`£${cheapest}`);
  });

  it('the 5+ bedrooms card is active and intentional, not disabled, and offers WhatsApp and a request-a-quote action', async () => {
    const user = userEvent.setup();
    renderWizard();
    const card = screen.getByRole('button', { name: /^5\+ bedrooms/ });
    expect(card).not.toBeDisabled();
    await user.click(card);
    expect(screen.getByText('Large properties are quoted individually')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp us/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request a quote/ })).toBeInTheDocument();
  });

  it('selecting 5+ bedrooms disables progression to the next step (base clean requires a manual quote)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /^5\+ bedrooms/ }));
    expect(screen.getByRole('button', { name: /^Next$/ })).toBeDisabled();
    expect(footerTotal()).toHaveTextContent('Quote required');
  });

  it('picking a normal size after 5+ bedrooms clears the quote-required state', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /^5\+ bedrooms/ }));
    await user.click(screen.getByRole('button', { name: /^3 beds/ }));
    expect(screen.queryByText('Large properties are quoted individually')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next$/ })).not.toBeDisabled();
  });
});

describe('EotQuoteWizard — Step 2: Choose your cleaning package', () => {
  it('shows both Complete and Tailored cards with correct, non-conflicting prices', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    expect(screen.getByText('Complete Agency-Ready Clean')).toBeInTheDocument();
    expect(screen.getByText('Tailored Checklist Clean')).toBeInTheDocument();
    expect(screen.getByTestId('complete-price')).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
    expect(screen.getByTestId('tailored-price')).toHaveTextContent(`£${EOT_TAILORED_START_PRICES_P.bed2 / 100}`);
  });

  it('Complete is selected by default and shows the recommended badge', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    expect(screen.getByText(/Recommended · Best value/)).toBeInTheDocument();
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
  });

  it('selecting Tailored updates the sticky summary to the Tailored current total', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    await user.click(screen.getByText('Tailored Checklist Clean'));
    expect(footerTotal()).toHaveTextContent(`£${EOT_TAILORED_START_PRICES_P.bed2 / 100}`);
    expect(screen.getByText(/Tailored Checklist Clean · based on your current selections/)).toBeInTheDocument();
  });
});

describe('EotQuoteWizard — Step 3: Floor care', () => {
  it('shows the three top-level floor-care choices with no carpet cards until Professional is chosen', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    expect(screen.getByText('What floor care do you need?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Standard floor care/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^No carpeted areas/ })).toBeInTheDocument();
    expect(screen.queryByText('Whole-property carpet cleaning')).not.toBeInTheDocument();
  });

  it('choosing Standard or No carpeted areas never charges anything extra', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Standard floor care/ }));
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
    await user.click(screen.getByRole('button', { name: /^No carpeted areas/ }));
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
  });

  it('choosing Professional carpet steam cleaning reveals the whole-property and manual carpet cards', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    expect(screen.getByText('Whole-property carpet cleaning')).toBeInTheDocument();
    expect(screen.getByText('Choose areas individually')).toBeInTheDocument();
    // Nothing is charged just from choosing "Professional" — no card picked yet.
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
  });

  it('the whole-property card shows a real, live saving example generated from the standalone catalogue (not a fake crossed-out price)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    const card = screen.getByText('Whole-property carpet cleaning').closest('button')!;
    expect(within(card).getByText(/separately/)).toBeInTheDocument();
    expect(within(card).getByText('You save')).toBeInTheDocument();
  });

  describe('Whole-property suggested layout', () => {
    async function toWholeProperty(user: ReturnType<typeof userEvent.setup>) {
      renderWizard();
      await toStep3(user);
      await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
      await user.click(screen.getByText('Whole-property carpet cleaning').closest('button')!);
    }

    it('shows the suggested layout immediately with live pricing, never silently pre-charging', async () => {
      const user = userEvent.setup();
      await toWholeProperty(user);
      expect(screen.getByText(/We have prepared a typical carpet layout/)).toBeInTheDocument();
      expect(screen.getByText('Bedroom 1')).toBeInTheDocument();
      expect(screen.getByText('Bedroom 2')).toBeInTheDocument();
      expect(screen.getByText('Living / reception room')).toBeInTheDocument();
      expect(screen.getByText('Hallway')).toBeInTheDocument();
      // Bedrooms + reception + hallway are pre-checked (2-bed flat) — visible in the price.
      const expectedSubtotal = CARPET_ITEM_PRICES_P.bedroom * 2 + CARPET_ITEM_PRICES_P.living_room + CARPET_ITEM_PRICES_P.hallway;
      expect(screen.getByText(`£${expectedSubtotal / 100}`)).toBeInTheDocument();
    });

    it('landing and stairs are suggested but NOT pre-checked for a flat — never silently assumed', async () => {
      const user = userEvent.setup();
      await toWholeProperty(user);
      const landingRow = screen.getByText('Landing').closest('.rounded-xl')! as HTMLElement;
      expect(within(landingRow).getByRole('checkbox')).not.toBeChecked();
      const stairsRow = screen.getByText('Stairs').closest('.rounded-xl')! as HTMLElement;
      expect(within(stairsRow).getByRole('checkbox')).not.toBeChecked();
    });

    it('unchecking every suggested area brings the price back down to the base package total, and never increases mid-way', async () => {
      const user = userEvent.setup();
      await toWholeProperty(user);
      const before = readFooterTotal();
      let running = before;
      for (const label of ['Bedroom 1', 'Bedroom 2', 'Living / reception room', 'Hallway']) {
        const row = screen.getByText(label).closest('.rounded-xl')! as HTMLElement;
        await user.click(within(row).getByRole('checkbox'));
        expect(readFooterTotal()).toBeLessThanOrEqual(running);
        running = readFooterTotal();
      }
      expect(readFooterTotal()).toBe(EOT_COMPLETE_PRICES_P.bed2 / 100);
      // Re-checking one area brings a real charge back.
      const bedroom1 = screen.getByText('Bedroom 1').closest('.rounded-xl')! as HTMLElement;
      await user.click(within(bedroom1).getByRole('checkbox'));
      expect(readFooterTotal()).toBeGreaterThan(EOT_COMPLETE_PRICES_P.bed2 / 100);
    });

    it('additional reception rooms, hallways and landings can be added and removed', async () => {
      const user = userEvent.setup();
      await toWholeProperty(user);
      for (const buttonName of ['+ Reception room', '+ Hallway', '+ Landing'] as const) {
        await user.click(screen.getByRole('button', { name: buttonName }));
      }
      const newReception = screen.getAllByText('Additional reception room');
      expect(newReception.length).toBe(1);
      const row = newReception[0].closest('.rounded-xl')! as HTMLElement;
      await user.click(within(row).getByRole('button', { name: 'Remove' }));
      expect(screen.queryByText('Additional reception room')).not.toBeInTheDocument();
      expect(screen.getAllByText('Hallway').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Landing').length).toBeGreaterThanOrEqual(2);
    });

    it('an added staircase defaults to 1 flight, and an extra flight raises the price', async () => {
      const user = userEvent.setup();
      await toWholeProperty(user);
      const stairsRow = screen.getByText('Stairs').closest('.rounded-xl')! as HTMLElement;
      await user.click(within(stairsRow).getByRole('checkbox'));
      const oneFlightTotal = readFooterTotal();
      await user.click(within(stairsRow).getByRole('button', { name: /Increase flights/ }));
      expect(readFooterTotal()).toBeGreaterThan(oneFlightTotal);
    });
  });

  describe('Manual carpet selection', () => {
    async function toManual(user: ReturnType<typeof userEvent.setup>) {
      renderWizard();
      await toStep3(user);
      await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
      await user.click(screen.getByText('Choose areas individually').closest('button')!);
    }

    it('starts at zero — nothing suggested, nothing charged', async () => {
      const user = userEvent.setup();
      await toManual(user);
      expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
    });

    it('below the 3-area offer threshold, shows the normal full-value calculation rather than promising 50%', async () => {
      const user = userEvent.setup();
      await toManual(user);
      await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
      // £50 standalone bedroom value is below the £85 carpet minimum, and one area never qualifies.
      expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100 + 85}`);
      expect(screen.getByText(/more qualifying area/)).toBeInTheDocument();
    });

    it('reaching 3 qualifying areas applies the package discount and never charges less than 2 areas already cost', async () => {
      const user = userEvent.setup();
      await toManual(user);
      await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
      await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
      const twoAreaTotal = readFooterTotal();
      await user.click(screen.getByRole('button', { name: /Increase Hallways/ }));
      expect(readFooterTotal()).toBeGreaterThanOrEqual(twoAreaTotal);
      expect(screen.getByText(/EOT carpet-package saving/)).toBeInTheDocument();
    });

    it('does not stack with the ordinary item-count carpet-bundle discount — only the 50% package rule applies', async () => {
      const user = userEvent.setup();
      await toManual(user);
      for (let i = 0; i < 7; i++) {
        await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
      }
      const subtotal = CARPET_ITEM_PRICES_P.bedroom * 7;
      const expectedCharge = Math.round(subtotal * 0.5); // exactly 50%, never an extra bundle-band discount on top
      expect(readFooterTotal()).toBe(EOT_COMPLETE_PRICES_P.bed2 / 100 + expectedCharge / 100);
    });

    it('dining rooms and living rooms both price from the same canonical living_room rate', async () => {
      const user = userEvent.setup();
      await toManual(user);
      await user.click(screen.getByRole('button', { name: /Increase Living rooms/ }));
      const oneLivingRoom = readFooterTotal();
      await user.click(screen.getByRole('button', { name: /Decrease Living rooms/ }));
      await user.click(screen.getByRole('button', { name: /Increase Dining rooms/ }));
      expect(readFooterTotal()).toBe(oneLivingRoom);
    });
  });

  it('switching back to Standard after choosing Professional clears any confirmed carpet charge', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    await user.click(screen.getByText('Choose areas individually').closest('button')!);
    await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
    expect(readFooterTotal()).toBeGreaterThan(EOT_COMPLETE_PRICES_P.bed2 / 100);
    await user.click(screen.getByRole('button', { name: /^Standard floor care/ }));
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
  });
});

describe('EotQuoteWizard — Step 4: Add-ons and final review', () => {
  it('Tailored shows the internal checklist, grouped, with nothing charged until checked', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep2(user);
    await user.click(screen.getByText('Tailored Checklist Clean'));
    await next(user); // → floor care
    await next(user); // → add-ons & review
    expect(screen.getByText('Add back the internal tasks you need')).toBeInTheDocument();
    expect(screen.getByText('Appliance interiors')).toBeInTheDocument();
    expect(screen.getByText('Cupboards and storage')).toBeInTheDocument();
    const fridgeRow = screen.getByText('Inside standard fridge/freezer').closest('label')!;
    expect(within(fridgeRow).getByRole('checkbox')).not.toBeChecked();
    expect(footerTotal()).toHaveTextContent(`£${EOT_TAILORED_START_PRICES_P.bed2 / 100}`);
  });

  it('Complete does not ask the customer to reselect included items', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    expect(screen.getByText(/Complete already includes every internal task above/)).toBeInTheDocument();
    expect(screen.queryByText('Add back the internal tasks you need')).not.toBeInTheDocument();
  });

  it('increasing an optional extra raises the total', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    await user.click(screen.getByRole('button', { name: /Increase Exterior windows/ }));
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100 + 35}`);
  });

  it('shows a static parking/Congestion Charge note with no selectable parking question and no charge added', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    expect(screen.getByText(/Parking costs are not included/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^yes$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Congestion Charge zone/)).not.toBeInTheDocument();
  });

  it('selecting a heavy/exceptional condition shows the photo-review notice with no automatic surcharge', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    await user.click(screen.getByRole('button', { name: /Mould, biohazard or specialist contamination/ }));
    expect(screen.getAllByText(/Photo review required/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/no automatic surcharge is applied/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows the deposit and correct remaining balance in the final review', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    expect(screen.getByText('£30')).toBeInTheDocument();
    const total = EOT_COMPLETE_PRICES_P.bed2 / 100;
    expect(screen.getByText(`£${total - 30}`)).toBeInTheDocument();
  });

  it('shows booking-request wording, never claiming a confirmed booking', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep4(user);
    expect(screen.getByText(/booking request until availability is confirmed/)).toBeInTheDocument();
    expect(screen.getByText(/due after the work is completed/)).toBeInTheDocument();
  });

  it('calling onBook produces a quoteConfig the server can independently price, with no parking fields', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<EotQuoteWizard onBook={onBook} />);
    await toStep4(user);
    await user.click(screen.getByRole('button', { name: /Continue to booking/ }));

    expect(onBook).toHaveBeenCalledTimes(1);
    const result = onBook.mock.calls[0][0] as EotBookingResult;
    expect(result.quoteConfig.deepService).toBe('end_of_tenancy');
    expect(result.quoteConfig.eotPackage).toBe('complete');
    expect(result.price).toBe(EOT_COMPLETE_PRICES_P.bed2 / 100);
    expect(result.quoteConfig).not.toHaveProperty('parking');
    expect(result.quoteConfig).not.toHaveProperty('congestionZone');
  });

  it('does not create a booking action for a heavy-condition quote — shows WhatsApp instead of a book button', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<EotQuoteWizard onBook={onBook} />);
    await toStep4(user);
    await user.click(screen.getByRole('button', { name: /Mould, biohazard or specialist contamination/ }));
    expect(screen.queryByRole('button', { name: /Continue to booking/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Send photos on WhatsApp/ })).toBeInTheDocument();
    expect(onBook).not.toHaveBeenCalled();
  });

  it('confirmed carpet areas and the package saving appear in the final review, matching Step 3 exactly', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    await user.click(screen.getByText('Choose areas individually').closest('button')!);
    await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
    await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
    await user.click(screen.getByRole('button', { name: /Increase Hallways/ }));
    const step3Total = readFooterTotal();
    await next(user); // → add-ons & review
    expect(readFooterTotal()).toBe(step3Total);
    expect(screen.getByText('Confirmed carpet areas')).toBeInTheDocument();
    expect(screen.getByText(/EOT carpet-package saving/)).toBeInTheDocument();
  });
});

describe('EotQuoteWizard — back navigation preserves selections', () => {
  it('property type, size and package survive navigating forward and back', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: 'House / Maisonette' }));
    await user.click(screen.getByRole('button', { name: /^3 beds/ }));
    await toStep2(user);
    await user.click(screen.getByText('Tailored Checklist Clean'));
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(screen.getByRole('button', { name: 'House / Maisonette' })).toHaveClass('border-royal-500');
    expect(screen.getByRole('button', { name: /^3 beds/ })).toHaveClass('border-royal-500');
    await next(user);
    expect(screen.getByText('Tailored Checklist Clean').closest('button')).toHaveClass('border-royal-500');
  });

  it('carpet selections survive navigating from Step 4 back to Step 3', async () => {
    const user = userEvent.setup();
    renderWizard();
    await toStep3(user);
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    await user.click(screen.getByText('Choose areas individually').closest('button')!);
    await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
    await next(user); // → step 4
    await user.click(screen.getByRole('button', { name: /^Back$/ })); // → step 3
    expect(screen.getByRole('button', { name: /Decrease Bedrooms/ })).toBeInTheDocument();
    const bedroomsCount = screen.getByRole('button', { name: /Decrease Bedrooms/ }).nextSibling as HTMLElement;
    expect(bedroomsCount).toHaveTextContent('1');
  });
});

describe('EotQuoteWizard — totals are monotonic (never decrease when scope is added)', () => {
  it('adding bathrooms and WCs only ever raises the footer total', async () => {
    const user = userEvent.setup();
    renderWizard();
    let prev = readFooterTotal();
    await user.click(screen.getByRole('button', { name: /Increase full bathrooms/ }));
    expect(readFooterTotal()).toBeGreaterThanOrEqual(prev);
    prev = readFooterTotal();
    await user.click(screen.getByRole('button', { name: /Increase separate WCs/ }));
    expect(readFooterTotal()).toBeGreaterThanOrEqual(prev);
  });

  it('crossing package, floor-care and add-on steps while adding scope never decreases the total', async () => {
    const user = userEvent.setup();
    renderWizard();
    let prev = readFooterTotal();
    await toStep2(user);
    expect(readFooterTotal()).toBeGreaterThanOrEqual(prev);
    prev = readFooterTotal();

    await next(user); // → floor care
    await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
    await user.click(screen.getByText('Choose areas individually').closest('button')!);
    await user.click(screen.getByRole('button', { name: /Increase Bedrooms/ }));
    expect(readFooterTotal()).toBeGreaterThanOrEqual(prev);
    prev = readFooterTotal();

    await next(user); // → add-ons & review
    await user.click(screen.getByRole('button', { name: /Increase Rubbish removal/ }));
    expect(readFooterTotal()).toBeGreaterThanOrEqual(prev);
  });
});

describe('EotQuoteWizard — restoring a previous session', () => {
  it('rehydrates property type, size and package from a restoreConfig', () => {
    const onBook = vi.fn();
    const restoreConfig: EotBookingResult['quoteConfig'] = {
      service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed3', deepBaths: 2, deepWcs: 1, isHouse: true,
      eotPackage: 'tailored',
      tailoredAddOns: { fridgeFreezerInside: true, extraFridgeFreezers: 0, dishwasherInside: false, washingMachineInside: false, cupboards: false },
      addOnCounts: {}, rooms: [], carpetRoomIds: [], windowSize: 'small', gutterType: 'terraced', officeHours: 2,
      condition: 'normal',
    };
    render(<EotQuoteWizard onBook={onBook} restoreConfig={restoreConfig} />);
    expect(screen.getByRole('button', { name: /^3 beds/ })).toHaveClass('border-royal-500');
    expect(screen.getByRole('button', { name: 'House / Maisonette' })).toHaveClass('border-royal-500');
  });
});
