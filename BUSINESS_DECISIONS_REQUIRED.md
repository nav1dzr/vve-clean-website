# Business Decisions Required — VVE Clean

These items were identified during the conversion design audit. Each requires a decision from the business owner before any code change is made.

---

## 1. Phone number in mobile sticky bar

**Current state (before this branch):** The mobile sticky bar showed "Call 020 8050 2233" as the primary action.

**Change made in this branch:** Replaced with "Get my price" (→ quote calculator). The phone number remains accessible in the navbar (mobile hamburger menu), the main footer, and the Contact section.

**Decision needed:** Is it acceptable to remove the phone number from the fixed mobile sticky bar, or should there be a third button or a help menu that shows the phone number alongside WhatsApp?

---

## 2. "50+ Happy Clients" claim in hero

**Previous state:** The hero had "50+ Happy Clients", "Expert Combined Experience", and "100% Satisfaction Rate" as three stats.

**Change made:** Replaced all three with verified facts: £5m public liability, 5-star Google reviews, DBS checked, 48hr re-clean guarantee.

**Decision needed:** The "50+ Happy Clients" figure was removed because it is not verifiable from the codebase. If this is a real, verified customer count the business can stand behind, it can be added back. Please confirm the current client count and whether you'd like it shown.

---

## 3. Google Reviews — displayed count vs actual count

**Current state:** The Reviews component shows 5 hardcoded Google reviews all rated 5 stars. The aggregate rating badge says "5.0 / 5".

**Issue:** The hero now says "5-star Google reviews". The footer and Google profile link claim a rating but do not show a review count.

**Decision needed:** 
- How many total Google reviews does VVE Clean currently have?
- Should the star rating badge show "5.0 · 12 reviews" (or actual count)?
- Do you want the hero trust strip to show the count? e.g. "5.0 · 14 Google reviews"

---

## 4. YouTube channel

**Previous state:** Footer had a YouTube icon button with `href="#"` (broken placeholder).

**Change made:** The YouTube icon has been removed from the footer social links.

**Decision needed:** Does VVE Clean have a YouTube channel? If so, provide the URL and it can be added back with the correct link.

---

## 5. Regular cleaning service

**Observation:** The QuoteCalculator shows "Regular service discounts available — 10% to 30% off depending on service type, frequency and property size." However, regular/recurring cleaning does not appear as a selectable service in the calculator or on the pricing page. It appears only as a nudge.

**Decision needed:** Should regular cleaning be a bookable service through the website, or is it intentionally handled via WhatsApp/phone only? If it should be online-bookable, this requires backend pricing logic.

---

## 6. "Occupied home" / regular cleaning wording

**Observation:** The TrustBadges and Services section do not mention whether VVE Clean accepts bookings for occupied homes (as opposed to vacant properties only for EOT/move-in). Carpet/upholstery cleaning can be done in occupied homes, but the property-size selectors for EOT and move-in say "Vacant properties only."

**Decision needed:** Is carpet and upholstery cleaning available for occupied homes? If yes, consider adding "Occupied homes welcome" to the Carpet & Upholstery service card.

---

## 7. After Builders clean — online booking vs photo quote

**Current state:** After Builders is intentionally photo-quote only (requires a WhatsApp photo before a price can be confirmed). This is correct and not changed.

**Observation:** The pricing page says "From £199 (photo quote)." The Services card says "WhatsApp a photo →". The calculator shows "From £199" with a photo-quote callout.

**No change needed** unless the business wants to introduce online-bookable fixed prices for standard after-builders sizes — but that is a pricing/business decision, not a design one.

---

## 8. Guarantee period — 48 hours vs 7 days

**Current state:** All claims say "48-hour re-clean guarantee."

**Decision needed:** Several competitors offer 72-hour or 7-day re-clean windows. If VVE Clean is willing to extend to 72 hours or 7 days, this would be a strong trust differentiator. This is a business policy decision — do not change without explicit confirmation.

---

## 9. Window cleaning scope — "interior and exterior"

**Observation:** The Services card for Window Cleaning says "Interior and exterior, streak-free, up to second-floor reach." The pricing page says "From £45, min callout £75." However, the calculator only shows exterior sizing options (1–2 bed / 3 bed / 4+ bed) with prices of £35, £45, £55.

**Possible inconsistency:** If interior is included in these prices, that should be explicit. If interior is a separate add-on, the Services card description may be misleading.

**Decision needed:** Confirm whether the calculator prices for window cleaning include interior windows, and whether any clarification is needed on the Services card or pricing page.

---

## 10. Commercial page — online booking

**Current state:** The commercial page has no online booking path. Commercial enquiries go via WhatsApp, email, or phone.

**Decision needed:** Should commercial clients ever be directed to the residential online-booking flow, or should they always be kept on the WhatsApp/phone/contact path? If the online flow should be available for commercial bookings (e.g. one-off office cleans), the calculator's "Office / Commercial" option already exists and creates a booking.

---

*Last updated: 2026-07-11*
*Branch: feat/conversion-design-improvements*
