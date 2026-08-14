import type { ServiceBenefit } from '../components/ServiceLandingLayout';
import { ClipboardList, PackageCheck, RefreshCw, Camera } from 'lucide-react';
import {
  EOT_BASE_PRICES_P,
  EOT_TAILORED_START_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_GUARANTEE_HOURS,
} from './pricing';

const pDisplay = (pence: number) => `£${pence / 100}`;

// Shared with the local area pages (src/pages/LocalEndOfTenancyPage.tsx) so
// pricing/benefits/checklist copy is never a second, separately-maintained
// set that could drift from the main London page.
export const EOT_PRICING_ROWS: { label: string; price: string }[] = [
  { label: 'Studio — Complete',                  price: pDisplay(EOT_BASE_PRICES_P.studio) },
  { label: '1 Bedroom — Complete',                price: pDisplay(EOT_BASE_PRICES_P.bed1) },
  { label: '2 Bedrooms — Complete',               price: pDisplay(EOT_BASE_PRICES_P.bed2) },
  { label: '3 Bedrooms — Complete',               price: pDisplay(EOT_BASE_PRICES_P.bed3) },
  { label: '4 Bedrooms — Complete',               price: pDisplay(EOT_BASE_PRICES_P.bed4) },
  { label: 'Studio — Tailored (from)',            price: pDisplay(EOT_TAILORED_START_PRICES_P.studio) },
  { label: '4 Bedrooms — Tailored (from)',        price: pDisplay(EOT_TAILORED_START_PRICES_P.bed4) },
  { label: 'Each additional full bathroom',       price: `+${pDisplay(EOT_EXTRA_BATH_P)}` },
  { label: 'Each additional separate WC',         price: `+${pDisplay(EOT_EXTRA_WC_P)}` },
  { label: '5+ Bedrooms',                         price: 'Tailored quote' },
];

export const EOT_PRICING_NOTE =
  'Prices are for normally maintained, vacant properties with reasonable access. Carpet steam cleaning, upholstery, exterior windows, balconies and rubbish removal are available as paid extras. Parking and the Congestion Charge, where applicable, are passed through at actual cost — never an invented flat fee — and confirmed with you before the booking is accepted. Heavy soiling, mould, biohazard contamination or extreme conditions require a photo review and confirmed quote before work starts.';

export const EOT_BENEFITS: ServiceBenefit[] = [
  {
    icon: <ClipboardList size={28} />,
    title: '67-point agency checklist',
    body: 'Every item your letting agent checks at inventory — we clean it on the Complete package. No area is missed because we work from the same standard checklist agents use.',
  },
  {
    icon: <PackageCheck size={28} />,
    title: 'Free oven clean included',
    body: 'Inside oven, hob, extractor filter and grill — all included at no extra cost on Complete, with no surprise appliance charges.',
  },
  {
    icon: <RefreshCw size={28} />,
    title: `${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`,
    body: `If your agent flags anything within ${EOT_GUARANTEE_HOURS} hours of your clean, we return to fix it for free. We ask only for a copy of the agent's written feedback.`,
  },
  {
    icon: <Camera size={28} />,
    title: 'Photographic cleaning receipt',
    body: 'We photograph the property after cleaning so you have documented proof. Useful for any deposit dispute where the condition at checkout is questioned.',
  },
];

export const EOT_WHY_POINTS: string[] = [
  '67-point agency checklist — the same one your agent uses',
  'Inside oven, hob, extractor filter and grill — free',
  'Inside all cupboards, drawers and wardrobes',
  'Bathrooms fully descaled, tiles, grouting and fixtures',
  'Internal windows cleaned streak-free',
  'Skirting boards, light switches and door frames wiped',
  `${EOT_GUARANTEE_HOURS}-hour free re-clean if your agent flags anything`,
  'Photographic cleaning receipt emailed on completion',
];
