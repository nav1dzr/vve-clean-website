# VVE Clean Pricing System

Internal reference for how pricing is stored, calculated and maintained. Not public-facing.

---

## Canonical source

All approved prices live in **`admin/shared/pricingCatalogue.js`**. This is the
one file to edit when a price changes.

Every price is stored as an **integer pence** value to avoid floating-point
error (`19900` = £199). Display conversion uses `/100`; never store prices as
decimal pounds in the catalogue.

The catalogue is plain JavaScript so every runtime imports the same values:

| Consumer | Responsibility |
|----------|----------------|
| `src/data/pricing.ts` | Typed public-app facade and display/calculation helpers |
| `api/servicePrices.js` | Server-authoritative checkout calculation; converts catalogue pence to pounds internally |
| `admin/api/_lib/catalogueSeed.js` | Builds the optional CRM catalogue seed rows directly from catalogue pence |

`admin/shared/pricingCatalogue.d.ts` supplies TypeScript declarations only. It
must describe the JavaScript exports, but it must never contain alternative
price values.

---

## Price update process

1. Edit the approved value in `admin/shared/pricingCatalogue.js`.
2. Update or add the relevant price expectation in `src/data/pricing.test.ts`
   and the server/CRM integration expectations in
   `tests/api/pricingMirrors.test.js`.
3. Run the root typecheck, tests and build.
4. Run the admin typecheck, tests and build.
5. Commit: `pricing: <what changed>`.
6. Do **not** call the live catalogue seed endpoint — the CRM admin who manages
   the product catalogue decides when to re-import.

Do not copy the new number into the public facade, checkout calculator or seed
builder. Those files import it automatically.

---

## Discount rules (carpet & upholstery only)

Bundle tiers apply to the **eligible carpet/upholstery subtotal** after any condition surcharge, before the minimum booking floor.

| Subtotal | Discount |
|----------|----------|
| £600+    | 10%      |
| £400–£599| 7.5%     |
| £250–£399| 5%       |
| Under £250 | None   |

**Rules:**
- Only the best single tier applies — tiers are **never stacked**.
- If a promo code (e.g. LEAFLET20 = 20%) gives a larger saving than the bundle tier, the promo wins. They are never combined.
- The £85 minimum booking floor is applied **after** the discount. If the discounted total is below £85, the customer pays £85 and no "you save £X" claim is shown.
- **No cap** on bundle saving (removed in July 2026 overhaul).

**Does NOT apply to:**
- EOT cleans, move-in cleans, after-builders, commercial cleaning
- EOT carpet add-ons (`EOT_CARPET_ADDON_PRICES_P`)
- Parking, congestion, access charges
- Manually agreed supplements

---

## Same-day and next-day policy

Same-day and next-day appointments use the **exact same prices and discounts** as any other booking. There is no automatic surcharge, priority fee or discount removal.

The only exception is a genuinely exceptional, manually agreed arrangement (e.g. emergency out-of-hours work at the customer's specific request). This is **never calculated automatically** — it requires explicit agreement and a custom invoice line.

The `SAME_DAY_POLICY_SHORT` constant in `pricing.ts` contains the approved customer-facing wording. Use it wherever this policy is referenced rather than writing it freehand.

---

## EOT and move-in bath model

Base prices assume 1 bathroom. Additional bathrooms are charged as add-ons:

- EOT: +£50 per extra full bathroom (`EOT_EXTRA_BATH_P`), +£25 per extra WC (`EOT_EXTRA_WC_P`)
- Move-in: +£40 per extra full bathroom (`MOVEIN_EXTRA_BATH_P`)

---

## Complete End of Tenancy package

The approved EOT product is a complete, fixed-price clean rather than a low
base price with essential inspection items sold separately.

| Property | Complete EOT price |
|----------|-------------------:|
| Studio | £229 |
| 1 bedroom | £299 |
| 2 bedrooms | £369 |
| 3 bedrooms | £449 |
| 4 bedrooms | £549 |
| 5+ bedrooms | Tailored quote required |

The package includes the oven/hob/extractor, inside an emptied fridge and
defrosted freezer, accessible dishwasher/washing-machine compartments,
cupboards inside and out, internal windows, descaling, standard rooms and
floors, products and equipment. Carpet steam cleaning remains a genuine
upgrade; ordinary vacuuming is included.

Flats/apartments have no property-type adjustment. Houses and maisonettes add
£35 (`EOT_HOUSE_ADJUSTMENT_P`) for the normal additional hallway, landing,
internal-staircase cleaning and movement between floors. Carpet steam cleaning
for stairs remains a separate upgrade.

Five-bedroom and larger properties never reuse the four-bedroom price. They
use the `bed5` tailored-quote path and may submit an enquiry without being shown
a misleading fixed total.

Customers may remove only the approved inspection-ready items in
`EOT_SCOPE_CREDITS_P`. The reduction is capped at the lower of 10% of the base
price or £30. Any reduction changes the label to Custom EOT and removes the
excluded item from the 48-hour re-clean guarantee.

The EOT quote offers upholstery and mattress upgrades at the same canonical
item prices used by the carpet/upholstery service. Curtains and blinds, full
wall washing, extreme buildup, mould, biohazards and unusual access remain
photo-review items rather than invented fixed-price extras.

## Parking and Congestion Charge

Access charges are shared by every fixed-price booking and are stored centrally:

- Free parking available: £0
- No free parking / not sure: £15 estimated allowance
  (`PARKING_ESTIMATE_P`). Parking is charged at actual cost and the final
  balance is adjusted if it costs less or more.
- Outside the Congestion Charge zone: £0
- Inside / not sure: £18 pass-through charge
  (`CONGESTION_CHARGE_P`), with “not sure” marked as estimated pending address
  confirmation.

The Congestion Charge is not a cleaning-service fee. There is no automatic ULEZ
fee and no same-day or next-day surcharge.

---

## After-builders pricing

After-builders prices are **always "from" / estimated**. The final price is confirmed by photo before work starts. The `AFTER_BUILDERS_FROM_PRICES_P` table gives indicative starting prices by size. Do not show these as fixed prices anywhere on the site.

---

## Commercial cleaning

| Service | Rate | Minimum |
|---------|------|---------|
| Regular contract | £27.50/hr | £55 (2 hrs) |
| One-off deep clean | £35/hr | £210 (6 hrs) |
| Shop / café | from £65/visit | |
| Communal areas | from £75/visit | |
| Commercial EOL clean | from £299 | |
| Commercial after builders | from £349 | |

---

## EOT carpet add-ons

When carpet cleaning is added to an EOT clean, reduced rates apply (travel and setup are already covered). These are stored in `EOT_CARPET_ADDON_PRICES_P` and **do not** receive the carpet bundle discount.

---

## Deposit system

The £30 booking deposit (`DEPOSIT_P = 3000`) is deducted from the final balance. It is charged at booking time via Stripe and is **not a pricing decision** — do not change it without also modifying the Stripe and booking flows.

---

## Things that must never be automated

The following charges require explicit manual agreement with the customer and must never be calculated or applied by any automatic system:

- Same-day / next-day surcharges (policy: none)
- Out-of-hours emergency fee
- Heavy soiling / biohazard supplement (beyond the standard heavy-condition 20%)
- Commercial site-visit surcharge
- After-builders scope adjustment
- Any charge not listed in `admin/shared/pricingCatalogue.js`

---

## Tests to run after any price change

```bash
npx vitest run src/data/pricing.test.ts
npx vitest run src/data/carpetPricing.test.ts
npx vitest run tests/api/pricingMirrors.test.js
npm run typecheck
npm run build          # verifies structured data renders correctly
```

The test files cover:
- All canonical price values (`pricing.test.ts`)
- Discount tier boundaries (£250, £400, £600) (`pricing.test.ts`)
- No stacking between promo and bundle (`pricing.test.ts`)
- Minimum booking floor (£85) (`carpetPricing.test.ts`)
- `SAME_DAY_POLICY_SHORT` policy wording (`pricing.test.ts`)
- `stairsLinePricePence` non-linear formula (`pricing.test.ts`)
- `penceToDisplay` formatting (`pricing.test.ts`)
- Server calculation from the shared catalogue (`pricingMirrors.test.js`)
- CRM seed output from the shared catalogue (`pricingMirrors.test.js`)
- Public TypeScript facade identity with the shared catalogue (`pricingMirrors.test.js`)
