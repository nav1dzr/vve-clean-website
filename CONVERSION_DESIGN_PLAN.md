# VVE Clean — Conversion Design Improvement Plan

Branch: `feat/conversion-design-improvements`

---

## 1. Current visual strengths

- Strong headline promise ("Get your full deposit back — or we re-clean free within 48 hours")
- Professional dark-navy / gold brand identity — distinctive, not generic
- Quote calculator is genuinely functional: live pricing, discount tiers, realistic service breakdown
- Booking flow is technically complete: quote → form → Stripe → confirmation
- Trust badges section communicates insurance, DBS, guarantee
- Reviews section has real names, real dates, real service context
- Before/after gallery with real job photography
- Payment page clearly shows £30 deposit vs remaining balance
- Google Ads conversion is server-verified and deduplicated

---

## 2. Current conversion weaknesses (confirmed by code inspection)

### CRITICAL

**A. Hero "Book Online" goes to the contact form (`#contact`), not the booking flow.**
- Visitors who click "Book Online" in the hero reach a contact message form.
- This is the single highest-impact conversion blocker on the page.
- Fix: Change this CTA to go to `#quote` (the calculator) or `/booking`.

**B. Mobile sticky bar has no online-booking path.**
- Current: "Call 020 8050 2233" + "WhatsApp Quote"
- A mobile visitor who wants to book online has no sticky button to reach the quote or booking.
- Fix: Replace "Call" with "Get my price" → `/#quote`.

### HIGH

**C. Hero stats include unverifiable placeholder claims.**
- "Expert Combined Experience" — vague, meaningless
- "100% Satisfaction Rate" — unverifiable marketing copy, reduces trust with sceptical visitors
- Fix: Replace with verified facts: £5m insured, DBS checked, 48hr re-clean guarantee.

**D. Navbar mobile button says "Pricing" but goes to `/#quote`.**
- Inconsistent label erodes trust in the navigation.
- Fix: Rename to "Get a price".

### MEDIUM

**E. Window cleaning service card goes to WhatsApp, but a window-cleaning calculator exists.**
- The quote calculator has a full window-cleaning size selector.
- The Services card sends window visitors to WhatsApp instead.
- Fix: Change window-cleaning CTA to `#quote`.

**F. Reviews section appears too far down the page.**
- Current order: Hero → Trust → Quote → Services → Gallery → OurKit → Reviews
- Social proof is needed BEFORE the visitor scrolls past the calculator.
- Fix: Move Reviews to directly after the Quote section.

**G. Right-side quote panel (desktop sidebar) doesn't show the deposit split.**
- The left panel's result box shows "£30 today / £X after" but only for carpet items.
- The sticky right panel shows only the total price.
- Fix: Add a visible "£30 now · £X after" deposit row in the right panel for all services.

**H. Right-panel WhatsApp label: "Book via WhatsApp: 07845 451111" competes with the book button.**
- Calling it "Book via" makes it feel like a primary action rather than a fallback.
- Fix: Rename to "Need help? Chat on WhatsApp" — preserving WhatsApp while clarifying it's a support path.

### LOW

**I. Footer YouTube link goes to `href="#"` (broken).**
- Looks unprofessional; any crawl or accessibility check will flag it.
- Fix: Remove the YouTube icon or point to the real channel if it exists.

**J. Booking page intro is generic.**
- Current: "Confirm your booking / Fill in your details and secure your slot with a £30 deposit."
- Could be warmer and clearer about the deposit coming off the total.
- Fix: "Almost done — your slot is nearly secured. / Complete your details and pay the £30 deposit. It comes straight off your final bill."

**K. Right-panel WhatsApp button text in the non-AfterBuilders case says "Book via WhatsApp: 07845 451111".**
- This is prominent enough to pull visitors away from the online funnel prematurely.

---

## 3. Components to change

| Component | Changes |
|-----------|---------|
| `src/components/Hero.tsx` | Fix secondary CTA destination; replace unverifiable stats |
| `src/components/Navbar.tsx` | Rename mobile button "Pricing" → "Get a price" |
| `src/components/MobileStickyFooter.tsx` | Replace Call button with "Get my price" → `/#quote` |
| `src/components/QuoteCalculator.tsx` | Add deposit split to right panel; rename WhatsApp label |
| `src/components/Services.tsx` | Window cleaning CTA: WhatsApp → `#quote` |
| `src/pages/BookingPage.tsx` | Improve intro heading/copy |
| `src/components/Footer.tsx` | Remove YouTube `href="#"` placeholder |
| `src/pages/HomePage.tsx` | Move Reviews section to after QuoteCalculator |

---

## 4. Components to preserve without changes

- `QuoteCalculator` pricing logic — all computations must be identical
- `BookingPage` form fields and validation logic — all fields required by backend preserved
- `BookingPage` submission handler — no changes to API calls
- `public/confirmation.html` — Google Ads conversion logic untouched
- All API routes (`api/*.js`)
- `LeafletPage` — attribution logic preserved
- `Guarantee`, `FAQ`, `Areas`, `Contact`, `Reviews` content
- All Tailwind/brand colours and typography
- All WhatsApp links (numbers, intent text) — only labels refined

---

## 5. Risks to the working booking system

| Risk | Mitigation |
|------|-----------|
| Changing Hero secondary CTA destination | Change is `#contact` → `#quote` — no backend impact |
| Moving sections in HomePage | Pure JSX reorder — no state or prop changes |
| MobileStickyFooter change | New CTA goes to `/#quote` — same as existing desktop CTA |
| QuoteCalculator right panel change | Display-only — no change to pricing logic or booking handler |
| Services CTA change | Only changes the `href` for window cleaning — no business logic |
| BookingPage intro text | Copy-only change — no form or validation impact |
| Footer YouTube removal | Removes a broken link — no business impact |

---

## 6. Before/after test plan

### After implementation, verify these journeys:

1. **Homepage hero → "Get my price"** → lands on calculator ✓
2. **Homepage hero → "See prices"** → lands on `/pricing` ✓
3. **Mobile sticky → "Get my price"** → scrolls to `#quote` calculator ✓
4. **Mobile sticky → WhatsApp** → opens WhatsApp with correct number/message ✓
5. **Services "Window cleaning" → "Get your price"** → scrolls to `#quote` ✓
6. **Quote calculator → "Book Online — Pay £30 Deposit"** → navigates to `/booking` ✓
7. **Booking form submit** → Stripe checkout opens ✓
8. **Reviews now appear BEFORE services** in homepage scroll order ✓
9. **Hero stats show** `£5m insured`, `DBS checked`, `48hr re-clean guarantee` ✓
10. **Footer YouTube icon is gone** ✓

### Confirm these systems are untouched:
- Stripe £30 deposit amount
- QuoteCalculator pricing output
- Google Ads conversion label `AW-18214693277/hUwdCK68gswcEJ3TuO1D`
- Leaflet attribution
- All WhatsApp numbers (447845451111)
- All phone numbers (02080502233)
