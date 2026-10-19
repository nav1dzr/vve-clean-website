# Google rating: connection and maintenance

Reviewed 15 September 2026. This refinement prepares website code only. It does not activate Google billing, create a key, change Vercel settings or publish a release.

## What customers see

Every numeric Google badge uses the same source. The server-rendered fallback is the owner-checked profile score: **5.0 from 26 reviews, checked 8 September 2026**. It remains visibly dated; it is not described as live. A successful official API response replaces the rating/count together and changes the source label to “Updated” with that response date. The compact hero badge still shows the date and exposes the complete rating in its accessible link label.

An unavailable, disabled or malformed API response leaves the checked fallback intact. Browser storage, service-worker caching, CDN caching and persistent API-result storage are not used. All badges in the current website visit share one request; the page does not repeatedly poll Google. Private booking-management pages make no rating request. A fresh visit requests a fresh aggregate when configured.

## Existing integration

`api/google-rating.js` already calls Google's official **Places API (New)** for the fixed, server-configured business. This refinement retains that design. It validates the aggregate, strips unrelated fields, requests attribution metadata and protects failures from exposing keys or provider error messages. It requests `rating,userRatingCount,attributions`; it does not request review text, reviewer profiles, photographs or customer records.

The badge displays Google Maps text attribution, keeps its number/date readable and reserves width for ordinary rating/count updates. The shared brand icon and profile links now live in a small module so rendering a badge does not import the entire reviews section.

The existing setup report records that automatic refresh was not configured. This phase did **not** inspect or change protected live environment values, and did **not** verify a paid Google API response. A dated badge is evidence of the fallback, not proof of an active API connection.

## Owner setup before activation

1. Confirm which Google Cloud project should own the website's Places usage and billing. Enable Places API (New), obtain the correct Place ID for VVE Clean and use a dedicated server-side key restricted to the required API. Do not paste the key into chat or use a `VITE_` variable. [Google setup documentation](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
2. Review the current price and set a small API quota plus billing alerts appropriate to website traffic. Rating/count fields are in the Place Details Enterprise tier. One shared call per visit avoids duplicate badge requests, but the public endpoint can still be requested directly; a provider quota is the cost cap. Do not assume billing alerts stop spending. [Field billing tiers](https://developers.google.com/maps/documentation/places/web-service/data-fields)
3. Include Google's required terms/privacy references in the public website policies before activation. Confirm attribution treatment against the current policy. The implementation makes no persistent cache of Places results. Additional third-party attribution is deliberately unsupported: if Google returns it, the route retains the dated fallback instead of omitting required credits. Extending that response needs an attributed layout and another review. [Google attribution and data policies](https://developers.google.com/maps/documentation/places/web-service/policies)
4. With approval, set these **server-only variables in the website Vercel project**, for the explicitly agreed environment: `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_PLACE_ID`, then `GOOGLE_RATING_ENABLED=true`. The website project is separate from CRM; no Supabase table or CRM setting is required. Do not copy a production key into a preview by default.
5. After an approved deployment, check `GET /api/google-rating` returns one validated aggregate with the expected business numbers. Inspect a homepage badge, service hero, pricing badge and trust section on phone/desktop. They must agree and show “Updated”. Check a disabled or failing fixture still shows the original “Checked” date. Never change the saved snapshot merely to match an unverified API result.

## Fallback maintenance

The only manually entered aggregate is `src/data/googleRating.ts`. Recheck the actual [VVE Clean Google profile](https://share.google/tZEyXUs0J0SxXZlDi) periodically while refresh remains disabled. Update rating, count and observed date together only after checking the profile; set the value to `null` if a number cannot be supported. Never move the date forward automatically. Current review quotations are preserved; they are not an automated “latest reviews” feed.

## Optional later work

An automated recent-review feed is a separate feature: Places returns a limited set ordered by relevance rather than a complete newest-first feed. It requires author/source attribution and clear ordering. Keeping the genuine existing quotations with a link to Google is simpler for the current website. [Place Details documentation](https://developers.google.com/maps/documentation/places/web-service/place-details)
