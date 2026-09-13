# Website and CRM refinement review — 13 September 2026

Prepared on `feature/website-final-completion`. Local review only; no push, deployment, migration, production-data mutation, cloud change or billing change in this phase.

## Website changes

- Homepage: three existing carpet, upholstery and end of tenancy photos, seven-second rotation, touch/keyboard/manual controls and pause. Existing homepage placement plus service position-one references are retained. Focus, hover, hidden tabs and reduced-motion settings pause automatic changes. Real fallback photos and their captions remain intact.
- Equipment: mint ticks and clearer spacing in the three existing equipment points.
- Gallery: compact service collections, media-type filters and deep links, featured media, wider comparisons, full-image viewing, appropriate responsive-image sizes and intentional local video playback. Existing approved assets, before/during/after labels and managed publishing order are unchanged. Research and verification: [gallery-research.md](gallery-research.md).
- Pricing: navy introduction/booking steps, tinted rows, clearer included-work and extras sections, unchanged figures and assumptions. Shared mobile actions keep the selected-service quote destination.
- Upholstery: shorter hero, earlier real photo, compact VAT note beside the unchanged price/minimum, detailed fabric guidance in the existing process section. Quote guidance now says furniture rather than rooms.
- Mobile actions: one shared rounded blue/green presentation, explicit WhatsApp label/icon, accessible contrast and safe-area clearance. Cookie buttons wrap below 360px while retaining the existing consent actions and synchronous height publication.

No price, guarantee, review, deposit, Stripe or booking-state calculation changed. The source price catalogue and generated admin mirror remain in sync. Google ratings still use the existing dated fallback when no current feed is available; this phase does not make that feed live.

## CRM correction and media boundary

Preview setup, token rejection, genuine membership denial and connectivity failures now have distinct outcomes. Protected records remain gated. Draft and pending-payment recovery is preserved when no membership denial was established; genuine denial, sign-out or identity change retains the existing cleanup.

[CRM findings, current VVE TEST status and required media checks](crm-access-and-media.md). VVE TEST is confirmed paused in the Supabase dashboard on 13 September. The earlier free-project-capacity rejection is dated 8 September; it was not retried today. The specific remote CRM API response was behind deployment protection, so the screenshot alone does not establish which backend rejection occurred.

The new Media workspace is on the completion branch. The recorded live CRM version has no Media route. Existing R2/Mux connection repairs are documented; a complete connected upload/processing/publication/website-display round trip remains outstanding. The existing financial migration remains unapplied remotely. The new local layout and access-message correction do not remove these release requirements.

## Verification

- Full website suite: 1,926 passed; 281 conditional/pending cases; zero failures. Following the final narrow-cookie layout and explicit no-transition correction, the affected consent/overlap suites were rerun: 23 passed.
- Full CRM suite: 900 passed; one existing TODO; zero failures. API/admin-isolation and invoice recovery behavior tested.
- Website and CRM TypeScript/build checks passed. Website lint has zero errors and seven existing fast-refresh warnings; changed CRM files lint clean. No new dependencies.
- Public client build, server render and all 37 route prerenders succeeded, plus the not-found document. The local website build uses dummy private-service connections. The server rejects submissions and private API operations.
- Homepage carousel independently verified at 320/390/1280px: all three photos decoded, stable card heights, 44px controls, actual touch/keyboard interaction, automatic rotation, focus/pause and reduced motion.
- Gallery independently verified with real Bricolage/Inter at 320/375/1280px for all three categories. No overflow or page errors. All 51 local images/posters decoded during the exhaustive scrolling pass; filters, lightbox keyboard/focus, pagination and local MP4 playback passed.
- Broad browser pass visited 39 route cases at 1365/390/320px: expected HTTP responses, no page exceptions and no broken rendered images. Three immediate post-resize overflow flags on homepage/carpet/sofa were rechecked after settling: no persistent page overflow. The existing confirmation template contains four state-specific H1 elements; this count was not introduced by this change.
- Final first-load cookie/bar probe sampled 537 frames with zero overlap; all narrow-phone cookie controls fit within the viewport and remain at least 44px high. Dismissal restores the bar position. Explicit transition-property:none also prevents the global reduced-motion rule from briefly animating its bottom offset.
- Root visually reviewed pricing, sofa and gallery with the real fonts. The sofa quote action still reaches the upholstery calculator. Shared mobile actions retain the booking callback, manual quote and service-specific pricing destinations.
- CRM synthetic browser checks at 320/390/768px: no outside/protected-data requests or page errors. Preview/network/unknown-403/rejected-token states preserve recovery while access remains gated. Independent auth review found no blocking issue.

The local website is served at `http://127.0.0.1:8771`. It is a visual/interaction review, not a connected booking or CRM environment. The existing online preview remains at `061019c`; the local phone/financial commits and this phase await a coordinated, explicitly approved preview release.

## Next release

1. Owner reviews the local homepage, gallery, pricing and sofa pages.
2. Obtain the repository-required approval for the specific website/CRM preview release. Keep production and the frozen release branch unchanged.
3. Separately make a verified isolated test database and test media destinations available, apply reviewed test migrations and provision the owner's test access.
4. Complete a real photo, before/after and video publishing cycle before describing Media as ready for day-to-day use.
