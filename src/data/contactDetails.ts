// Single source of truth for VVE Clean's contact details and external proof
// links. Existing components (Navbar, Footer, homepage Contact) now import
// from here too, so a number/address/hours change never has to be made in
// more than one place.

export const CONTACT_PHONE_DISPLAY = '020 8050 2233';
export const CONTACT_PHONE_TEL = 'tel:02080502233';
export const CONTACT_EMAIL = 'contact@vveclean.co.uk';
export const CONTACT_ADDRESS_LINE1 = '23–25 Queensway';
export const CONTACT_ADDRESS_LINE2 = 'London W2 4QP';
// Owner-supplied. Sunday is deliberately not stated — we were told the
// Monday-Saturday window, not that Sunday is closed, and inventing a claim
// about a day we weren't told about is exactly the kind of unsupported
// promise this file exists to prevent.
export const CONTACT_HOURS = 'Monday – Saturday, 8am – 6pm';

// Canonical WhatsApp number used sitewide (Navbar, Footer, Contact, FAQ,
// PricingPage).
export const WA_NUMBER_DISPLAY = '07845 451111';
export const WA_BASE = 'https://wa.me/447845451111';

// Independent, third-party proof — not owner-controlled copy. Checked
// 2026-08-11: the live profile identifies VVE Limited, names Mr Navid Zarei
// as owner, shows Checkatrade-member-since June 2026, and states the trade
// passed up to 12 Checkatrade vetting checks. Do NOT hardcode a rating or
// review count here — Checkatrade's own page is the only place that number
// should ever be read from, because it changes.
//
// Known conflict (owner checklist item — see handoff report): the profile's
// "Who we are" copy is currently founder/owner-centric (e.g. "same cleaner
// attends every job", no subcontractors) and has not yet been updated to
// match the team-first positioning used on this site. That is an external
// edit only the owner can make on Checkatrade — nothing in this repo can fix
// it, so this comment exists to make sure it isn't forgotten.
export const CHECKATRADE_URL = 'https://www.checkatrade.com/trades/vvelimited';
export const CHECKATRADE_LABEL = 'View our Checkatrade profile';
