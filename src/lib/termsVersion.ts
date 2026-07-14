// Single source of truth for the Terms of Service / cancellation policy
// version string. Bump this whenever TermsOfServicePage.tsx's substantive
// content changes, so newly-recorded acceptances are attributable to the
// exact wording the customer agreed to.
//
// The cancellation policy lives inside the same Terms of Service document
// (see TermsOfServicePage.tsx §5) rather than a separate document, so both
// versions currently track together. If the cancellation policy is ever
// split into its own document with its own change cadence, give it its own
// version constant at that point.
export const TERMS_VERSION = '2026-07-14';
export const CANCELLATION_POLICY_VERSION = '2026-07-14';
