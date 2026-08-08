# VVE Clean design system

**Project:** VVE Clean  
**Updated:** 8 August 2026
**Product:** Mobile-first local cleaning and booking website

## Experience principles

1. Answer service, coverage, price and next-step questions quickly.
2. Keep the mobile booking action available without covering content.
3. Prefer calm evidence over urgency or promotional language.
4. Use real job imagery and label location proof conservatively.
5. A booking request is not a confirmed appointment.

## Tokens

| Role | Value | Use |
|---|---|---|
| Navy | `#020B24` | Dark sections and footer |
| Ink | `#10243E` | Primary text |
| Action | `#0369A1` | Primary button and link |
| Action hover | `#075985` | Hover/pressed |
| Action dark | `#0C4A6E` | Gradient and emphasis |
| Fresh teal | `#0F766E` | Hero-gradient lift and cleaning accent |
| Fresh blue | `#0B7199` | Hero-gradient finish |
| Sky | `#38BDF8` | Decorative accent only |
| Surface | `#F7FAFC` | Alternating section |
| Muted | `#5B6B7C` | Secondary text |
| Line | `#DCE5EC` | Border and divider |
| Silver 500 | `#64748b` | Secondary UI text (4.76:1 on white) |
| Silver 600 | `#566274` | Secondary UI text needing more weight (6.19:1) |
| Silver 700 | `#47505e` | Body text on light surfaces (8.15:1) |
| Success | `#15803D` | Confirmed status |
| Error | `#B42318` | Validation and destructive state |
| WhatsApp | `#075E54` | WhatsApp action with white text |

White text on the Action and WhatsApp tokens must pass WCAG AA for normal text. Sky blue is not a white-text button background.

The Silver scale is monotonic: a higher number is always darker. Steps 500 to 700 all clear AA for normal text on white, on Surface and on `amber-50`. Silver 400 (`#ced4da`) is a border, divider and disabled-state colour only — never text on a light background. This matters because the scale used to break here: 600 was `#8d97a0` at 2.97:1, lighter than both 500 and 700, and reading as "darker than 500" it had been used for quote-calculator helper text and cookie-consent descriptions that consequently failed contrast.

## Typography

- Heading: Bricolage Grotesque, 700 to 800.
- Body: Inter, 400 to 600.
- Mobile body and form controls: 16px minimum where the user must read or enter data.
- H1: 36px mobile, 48 to 60px desktop depending on length.
- H2: 30 to 40px.
- Body line height: 1.55 to 1.7.

## Spacing and layout

- Spacing unit: 4px.
- Mobile content gutter: 16px.
- Desktop content maximum: 1120 to 1280px.
- Main section padding: 64 to 80px; compact mobile sections may use 48px.
- Cards: 16 to 24px padding, 16 to 24px radius.
- Tap targets: 44 by 44px minimum.
- Sticky mobile bar: 56px plus safe-area inset.

## Components

### Primary button

- Action background, white text, 48px recommended height.
- One primary action per section.
- Label the outcome: "Get my price" or "Send booking request".

### Secondary action

- White or transparent background with Action/Navy text and a visible border.
- Call and WhatsApp may be persistent but visually secondary to quote/booking.

### Cards

- White on Surface, one-pixel Line border and restrained shadow.
- Do not rely on colour alone for selected state. Use `aria-pressed`, radio semantics, an icon or a text label.

### Forms

- Label every field.
- Mark required fields in text and semantics.
- Put error text next to the field, announce it, and focus the first invalid control on submit.
- State when a date is only preferred and when confirmation happens.

### FAQ

- Visible accordion text and FAQ structured data must match exactly.
- Generate both from one array per page. Never hand-write a second copy for the schema — six pages did, and every one of them drifted, including a re-clean guarantee that lost its exclusions in the schema only. `src/pages/faqSchemaParity.test.tsx` enforces question and answer parity.
- Add FAQ schema only to pages with useful, visible questions.
- Aim for five to nine service-specific questions when the page has enough useful customer information. Do not pad a page with repeated or invented answers.

### Prerendered heroes

- Anything above the fold must render from the server HTML. Scroll-reveal animation is for sections the visitor has to scroll to reach.
- `useReveal` starts hidden and only becomes visible in an effect, so a hero wrapped in it ships as `opacity-0` and stays blank until the client bundle hydrates. `ServiceLandingLayout.heroVisible.test.tsx` asserts this against the server render.

## Motion

- 150 to 300ms transitions.
- Avoid decorative continuous animation except a slow area marquee.
- Respect `prefers-reduced-motion` globally.

## Copy guardrails

- No deposit-return promise.
- No fake availability, countdown, social-proof ticker or invented response time.
- No universal staff, health, stain-removal or local-proof claim without evidence.
- The 72-hour re-clean terms must be attached only to the applicable end of tenancy package or selected tasks.
- See `docs/BRAND_AND_UI_GUIDE.md` for voice and imagery rules.
