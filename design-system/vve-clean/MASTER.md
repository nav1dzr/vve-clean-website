# VVE Clean design system

**Project:** VVE Clean  
**Updated:** 7 August 2026  
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
| Sky | `#38BDF8` | Decorative accent only |
| Surface | `#F7FAFC` | Alternating section |
| Muted | `#5B6B7C` | Secondary text |
| Line | `#DCE5EC` | Border and divider |
| Success | `#15803D` | Confirmed status |
| Error | `#B42318` | Validation and destructive state |
| WhatsApp | `#075E54` | WhatsApp action with white text |

White text on the Action and WhatsApp tokens must pass WCAG AA for normal text. Sky blue is not a white-text button background.

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
- Add FAQ schema only to pages with useful, visible questions.

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
