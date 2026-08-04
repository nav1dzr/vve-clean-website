import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EotQuoteWizard, { type EotBookingResult } from './EotQuoteWizard';
import { EOT_COMPLETE_PRICES_P, EOT_TAILORED_START_PRICES_P, EOT_HOUSE_ADJUSTMENT_P, EOT_EXTRA_BATH_P } from '../data/pricing';

function renderWizard(onBook = vi.fn()) {
  const utils = render(<EotQuoteWizard onBook={onBook} />);
  return { onBook, ...utils };
}

async function goToStep(user: ReturnType<typeof userEvent.setup>, n: number) {
  for (let i = 1; i < n; i++) {
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
  }
}

function footerTotal() {
  return screen.getByTestId('footer-total');
}

describe('EotQuoteWizard — Step 1: Property', () => {
  it('defaults to a 2-bed flat and shows the Complete starting price', () => {
    renderWizard();
    expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument();
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
  });

  it('selecting house adds the house/maisonette adjustment to the displayed price', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: 'house' }));
    expect(screen.getByText(new RegExp(`\\+£${EOT_HOUSE_ADJUSTMENT_P / 100} house/maisonette`))).toBeInTheDocument();
  });

  it('changing property size updates the starting-price summary and footer total', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /^1 bed/ }));
    expect(screen.getByText(/Starting price for 1 bed/)).toBeInTheDocument();
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed1 / 100}`);
  });
});

describe('EotQuoteWizard — Step 2: Bathrooms', () => {
  it('increasing full bathrooms adds the extra-bathroom charge', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToStep(user, 2);
    await user.click(screen.getByRole('button', { name: /Increase full bathrooms/ }));
    expect(screen.getByText(new RegExp(`\\+£${EOT_EXTRA_BATH_P / 100} for 1 extra bathroom`))).toBeInTheDocument();
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100 + EOT_EXTRA_BATH_P / 100}`);
  });

  it('back navigation from step 2 to step 1 preserves the previously selected property type', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: 'maisonette' }));
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(screen.getByRole('button', { name: 'maisonette' })).toHaveClass('border-royal-500');
  });
});

describe('EotQuoteWizard — Step 3: Package comparison', () => {
  it('shows both Complete and Tailored cards with correct prices', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToStep(user, 3);
    expect(screen.getByText('Complete Agency-Ready Clean')).toBeInTheDocument();
    expect(screen.getByText('Tailored Checklist Clean')).toBeInTheDocument();
    expect(screen.getByTestId('complete-price')).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
    expect(screen.getByTestId('tailored-price')).toHaveTextContent(`£${EOT_TAILORED_START_PRICES_P.bed2 / 100}`);
  });

  it('Complete is selected by default and shows the recommended badge', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToStep(user, 3);
    expect(screen.getByText(/Recommended · Best value/)).toBeInTheDocument();
  });

  it('selecting Tailored then advancing shows Step 4 (skipped entirely for Complete)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToStep(user, 3);
    await user.click(screen.getByText('Tailored Checklist Clean'));
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(screen.getByText('Add back the internal tasks you need')).toBeInTheDocument();
  });

  it('Complete package skips Step 4 and goes straight to floor care', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToStep(user, 3);
    // Complete already selected by default
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(screen.getByText('Floor care')).toBeInTheDocument();
  });

  it('back navigation from floor care returns to Package for Complete (step 4 is skipped both ways)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToStep(user, 3);
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // → floor care
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(screen.getByText('How would you like your clean prepared?')).toBeInTheDocument();
  });
});

describe('EotQuoteWizard — Step 4: Tailored add-ons', () => {
  async function toTailoredAddOns(user: ReturnType<typeof userEvent.setup>) {
    renderWizard();
    await goToStep(user, 3);
    await user.click(screen.getByText('Tailored Checklist Clean'));
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
  }

  it('every add-on price is shown before selection, and nothing is added until checked', async () => {
    const user = userEvent.setup();
    await toTailoredAddOns(user);
    const fridgeRow = screen.getByText('Inside standard fridge/freezer').closest('label')!;
    const checkbox = within(fridgeRow).getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(within(fridgeRow).getByText(/\+£25/)).toBeInTheDocument();
    expect(footerTotal()).toHaveTextContent(`£${EOT_TAILORED_START_PRICES_P.bed2 / 100}`);
  });

  it('checking add-ons that reach the Complete price shows the switch-to-Complete nudge', async () => {
    const user = userEvent.setup();
    await toTailoredAddOns(user);
    for (const label of ['Inside standard fridge/freezer', 'Inside dishwasher compartments', 'Inside washing-machine compartments', 'Cupboards, drawers & wardrobes']) {
      await user.click(within(screen.getByText(label).closest('label')!).getByRole('checkbox'));
    }
    expect(screen.getByText(/Complete saves you money and covers the full internal checklist/)).toBeInTheDocument();
  });

  it('tapping the switch-to-Complete nudge changes the selected package', async () => {
    const user = userEvent.setup();
    await toTailoredAddOns(user);
    for (const label of ['Inside standard fridge/freezer', 'Inside dishwasher compartments', 'Inside washing-machine compartments', 'Cupboards, drawers & wardrobes']) {
      await user.click(within(screen.getByText(label).closest('label')!).getByRole('checkbox'));
    }
    await user.click(screen.getByText(/Complete saves you money/));
    // Tailored add-ons step is now skipped (package is Complete) — Back goes to Package.
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(screen.getByText('Complete Agency-Ready Clean').closest('button')).toHaveClass('border-royal-500');
  });
});

describe('EotQuoteWizard — Step 5: Floor care', () => {
  async function toFloorCare(user: ReturnType<typeof userEvent.setup>) {
    renderWizard();
    await goToStep(user, 3);
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // Complete → floor care
  }

  it('generates default rooms for a 2-bed property (2 bedrooms + reception + hallway)', async () => {
    const user = userEvent.setup();
    await toFloorCare(user);
    expect(screen.getByText('Bedroom 1')).toBeInTheDocument();
    expect(screen.getByText('Bedroom 2')).toBeInTheDocument();
    expect(screen.getByText('Living / reception room')).toBeInTheDocument();
    expect(screen.getByText('Hallway')).toBeInTheDocument();
  });

  it('marking a room as carpet reveals the steam-cleaning add-on option', async () => {
    const user = userEvent.setup();
    await toFloorCare(user);
    const bedroomRow = screen.getByText('Bedroom 1').closest('.rounded-xl')! as HTMLElement;
    await user.click(within(bedroomRow).getByRole('button', { name: 'Carpet' }));
    expect(within(bedroomRow).getByText(/Add professional carpet steam cleaning/)).toBeInTheDocument();
  });

  it('adding carpet steam cleaning to a room increases the footer total by the discounted add-on rate', async () => {
    const user = userEvent.setup();
    await toFloorCare(user);
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
    const bedroomRow = screen.getByText('Bedroom 1').closest('.rounded-xl')! as HTMLElement;
    await user.click(within(bedroomRow).getByRole('button', { name: 'Carpet' }));
    await user.click(within(bedroomRow).getByRole('checkbox'));
    // £40 EOT carpet add-on for a bedroom
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100 + 40}`);
  });

  it('marking a room "N/A" hides the steam-cleaning option and does not charge for it', async () => {
    const user = userEvent.setup();
    await toFloorCare(user);
    const bedroomRow = screen.getByText('Bedroom 1').closest('.rounded-xl')! as HTMLElement;
    await user.click(within(bedroomRow).getByRole('button', { name: 'N/A' }));
    expect(within(bedroomRow).queryByText(/Add professional carpet steam cleaning/)).not.toBeInTheDocument();
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100}`);
  });

  it('additional reception rooms can be added and removed', async () => {
    const user = userEvent.setup();
    await toFloorCare(user);
    await user.click(screen.getByRole('button', { name: '+ Reception room' }));
    const newRooms = screen.getAllByText('Additional reception room');
    expect(newRooms.length).toBe(1);
    const row = newRooms[0].closest('.rounded-xl')! as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('Additional reception room')).not.toBeInTheDocument();
  });
});

describe('EotQuoteWizard — Step 6: Extras & condition', () => {
  async function toExtras(user: ReturnType<typeof userEvent.setup>) {
    renderWizard();
    await goToStep(user, 3);
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // → floor care
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // → extras
  }

  it('increasing exterior windows adds its price to the footer total', async () => {
    const user = userEvent.setup();
    await toExtras(user);
    await user.click(screen.getByRole('button', { name: /Increase Exterior windows/ }));
    expect(footerTotal()).toHaveTextContent(`£${EOT_COMPLETE_PRICES_P.bed2 / 100 + 35}`);
  });

  it('selecting a heavy/exceptional condition shows the photo-review notice and no automatic surcharge language', async () => {
    const user = userEvent.setup();
    await toExtras(user);
    await user.click(screen.getByRole('button', { name: /Mould, biohazard or specialist contamination/ }));
    expect(screen.getByText(/Photo review required/)).toBeInTheDocument();
    // The only mention of "surcharge" must be the explicit disclaimer that none is applied automatically.
    expect(screen.getByText(/no automatic surcharge is applied/i)).toBeInTheDocument();
  });
});

describe('EotQuoteWizard — Step 7: Review', () => {
  async function toReview(user: ReturnType<typeof userEvent.setup>) {
    renderWizard();
    await goToStep(user, 3);
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // floor care
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // extras
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // review
  }

  it('shows the £30 deposit and correct remaining balance', async () => {
    const user = userEvent.setup();
    await toReview(user);
    expect(screen.getByText('£30')).toBeInTheDocument();
    const total = EOT_COMPLETE_PRICES_P.bed2 / 100;
    expect(screen.getByText(`£${total - 30}`)).toBeInTheDocument();
  });

  it('shows booking-request and balance-timing wording, never claiming a confirmed booking', async () => {
    const user = userEvent.setup();
    await toReview(user);
    expect(screen.getByText(/booking request until availability is confirmed/)).toBeInTheDocument();
    expect(screen.getByText(/due after the work is completed/)).toBeInTheDocument();
  });

  it('calling onBook produces a quoteConfig the server can independently price', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<EotQuoteWizard onBook={onBook} />);
    await goToStep(user, 3);
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
    await user.click(screen.getByRole('button', { name: /Book online — pay £30 deposit/ }));

    expect(onBook).toHaveBeenCalledTimes(1);
    const result = onBook.mock.calls[0][0] as EotBookingResult;
    expect(result.quoteConfig.deepService).toBe('end_of_tenancy');
    expect(result.quoteConfig.eotPackage).toBe('complete');
    expect(result.price).toBe(EOT_COMPLETE_PRICES_P.bed2 / 100);
  });

  it('does not create a booking action for a heavy-condition quote — shows WhatsApp instead of a book button', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<EotQuoteWizard onBook={onBook} />);
    await goToStep(user, 3);
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // floor care
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // extras
    await user.click(screen.getByRole('button', { name: /Mould, biohazard or specialist contamination/ }));
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // review
    expect(screen.queryByRole('button', { name: /Book online — pay £30 deposit/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Send photos on WhatsApp/ })).toBeInTheDocument();
    expect(onBook).not.toHaveBeenCalled();
  });
});

describe('EotQuoteWizard — totals are monotonic (never decrease when scope is added)', () => {
  it('adding bathrooms, WCs and exterior windows only ever raises the footer total', async () => {
    const user = userEvent.setup();
    renderWizard();

    const readTotal = () => Number(footerTotal().textContent!.replace('£', ''));

    let prev = readTotal();
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // → bathrooms
    await user.click(screen.getByRole('button', { name: /Increase full bathrooms/ }));
    expect(readTotal()).toBeGreaterThanOrEqual(prev);
    prev = readTotal();

    await user.click(screen.getByRole('button', { name: /Increase separate WCs/ }));
    expect(readTotal()).toBeGreaterThanOrEqual(prev);
  });

  it('crossing package/floor-care/extras steps and adding scope at each never decreases the total', async () => {
    const user = userEvent.setup();
    renderWizard();
    const readTotal = () => Number(footerTotal().textContent!.replace('£', ''));

    let prev = readTotal();
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // step 2
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // step 3 package
    expect(readTotal()).toBeGreaterThanOrEqual(prev);
    prev = readTotal();

    await user.click(screen.getByRole('button', { name: /^Next$/ })); // step 5 floor care
    const bedroomRow = screen.getByText('Bedroom 1').closest('.rounded-xl')! as HTMLElement;
    await user.click(within(bedroomRow).getByRole('button', { name: 'Carpet' }));
    await user.click(within(bedroomRow).getByRole('checkbox'));
    expect(readTotal()).toBeGreaterThanOrEqual(prev);
    prev = readTotal();

    await user.click(screen.getByRole('button', { name: /^Next$/ })); // step 6 extras
    await user.click(screen.getByRole('button', { name: /Increase Rubbish removal/ }));
    expect(readTotal()).toBeGreaterThanOrEqual(prev);
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
      condition: 'normal', parking: 'unsure', congestionZone: false,
    };
    render(<EotQuoteWizard onBook={onBook} restoreConfig={restoreConfig} />);
    expect(screen.getByRole('button', { name: /^3 beds/ })).toHaveClass('border-royal-500');
    expect(screen.getByRole('button', { name: 'house' })).toHaveClass('border-royal-500');
  });
});
