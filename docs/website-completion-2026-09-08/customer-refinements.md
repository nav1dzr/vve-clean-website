# Customer refinements — 8 September 2026

This phase follows Navid's feedback on the pricing page, end-of-tenancy mobile hero, WhatsApp colour, Google rating, basket and carpet process. It changes the completion preview branch only. It does not activate the CRM journey, change prices or payment behavior, or release to production.

## Implemented

- Pricing shows one selected service at a time, with a Complete/Tailored comparison, relevant minimum/scope information, optional extras in a disclosure and a separate request/agreement/deposit explanation. Values still come from the shared price catalogue.
- The end-of-tenancy hero uses a soft blue background, tighter mobile spacing, shorter supporting text and the existing real kitchen photograph with a visible caption. The photographed asset loaded successfully at 390px. Failed photographs now give a gallery link instead of a broken image or an unrelated replacement.
- Service-hero WhatsApp text and symbols are green; pricing help and its mobile WhatsApp action use the same treatment.
- Shared Google badges show the verified 5.0 score and 26 reviews, checked directly on the public profile on 8 September. Review sections, trust badges, gallery and service/local proof use the shared source.
- The header basket saves one active quote, including mixed carpet/upholstery choices and unfinished end-of-tenancy wizard choices/step, in this browser for 14 days. Continuing recalculates current prices. It stores no payment credentials or contact fields. Removing the final carpet item empties the saved quote. Successful booking-request creation clears the saved basket. It does not reserve availability or combine multiple separate appointments.
- Four clear carpet steps appear on the carpet service page, covered local pages and the separate process guide. The guide places the steps first; optional equipment footage is a separate disclosure.

## Google automatic updates: connection still required

The public profile checked was [VVE Clean on Google](https://share.google/tZEyXUs0J0SxXZlDi). The checked snapshot is dated and is not described as an automatically updated score.

`GET /api/google-rating` supports the official Places API. The server requests only `rating,userRatingCount` for the configured fixed business; all public badges share one same-origin request per page visit. Private booking pages do not request it. Invalid responses or outages retain the verified snapshot. Google credentials never go into browser code.

The website's inspected environment had no Places credentials. Automatic refresh therefore remains disabled. To connect, configure server-only `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_PLACE_ID`, and `GOOGLE_RATING_ENABLED=true` for the intended environment, using the correct VVE business and a restricted Places API key. Check the API's billing and terms before activation. No credentials, Google billing or environment flags were changed in this phase. Reference: [official Place Details documentation](https://developers.google.com/maps/documentation/places/web-service/place-details).

## Validation

- Full root suite after the complete build: 1,789 passed, zero failed, 255 conditional skips. Skips are not evidence of provider connectivity.
- Website build and TypeScript checks passed; lint: zero errors, seven existing warnings.
- Added API checks cover disabled configuration, fixed-provider requests, invalid aggregates and method restrictions. Basket checks exercise mixed selections/current totals, unfinished EOT restoration, final-item removal and expired/malformed browser storage.
- Browser review: 390px EOT image/background/WhatsApp/header; 390px pricing and desktop pricing; category switching; mixed bedroom + three-seater quote restored through Pricing and refresh at £145; shared carpet steps on Islington. No horizontal overflow in the inspected phone pricing state, and no captured console errors during the basket check.
- Initial test failures from reading `dist` during a simultaneous rebuild were resolved by rerunning after the build. Existing gallery/rating/mobile-style assertions were aligned with the requested visible changes.

## Existing external work

See [implementation status](implementation-status.md) for the remaining connected CRM, email, payment, media and Ads checks. A third Supabase project is not required for the finished production website; a separate database was proposed for isolated integration testing. The intended admin booking-notification address still needs its complete domain confirmed before recipient configuration. No real emails were sent.
