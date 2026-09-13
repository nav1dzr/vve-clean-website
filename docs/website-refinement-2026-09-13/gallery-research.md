# Gallery design research and implementation — 13 September 2026

The gallery now gives each service a recognisable collection, makes its first published item prominent, and lets visitors choose comparisons, photos or videos. It keeps the existing approved photos, pairings and managed-media references. No replacement images were downloaded or generated.

## Research method

Opened the 11 website pages below and reviewed their available page structure, captions, navigation and calls to action. These are observations of public pages, not evidence of their conversion rates or independent verification of their cleaning claims. This was not a complete visual or accessibility audit of those businesses. Design choices for VVE are our judgement from those observations and VVE's existing media.

| Website opened | Useful observation | VVE application |
| --- | --- | --- |
| [London End of Tenancy Cleaning — gallery](https://londonendoftenancycleaning.london/gallery/) | Gallery photos are identified by room or task, with a quote route following the collection. | Keep factual subject captions and a quote link for the service being viewed. |
| [Skycleaners — gallery](https://skycleaners.co.uk/gallery/) | A named results section connects before/after photos to end of tenancy cleaning. | Give each service a clear collection heading; avoid a mixed wall of unexplained images. |
| [Cleaners of London — carpet cleaning](https://www.cleanersoflondon.co.uk/carpet-cleaning/) | The method and before/after results are separate sections; comparisons explain the photographed subject. | Let photos carry the gallery, while detailed service information stays on the relevant service page. |
| [Magic Pro Cleaning — end of tenancy](https://magicprocleaning.co.uk/end-of-tenancy-cleaning) | Results are separated into recognisable tasks such as ovens, bathrooms and windows, with explicit stage labels. | Preserve subject captions and the existing before/during/after distinctions; do not import their outcome promises. |
| [Wizard Cleaning — image gallery](https://wizardcleaning.co.uk/gallery/) | The collection includes technicians, equipment, work in progress and finished results. | Retain VVE's process clips and supporting photos, rather than treating every image as a finished result. |
| [Prestige Commercial — before and after](https://www.prestigecommercial.co.uk/image-gallery/before-and-after) | Navigation distinguishes before/after, work in progress and videos. Some captions expose filenames. | Add media-type filters, but retain VVE's human-readable captions instead of turning upload filenames into display copy. |
| [Royal Touch Cleaning — gallery](https://www.royaltouchcleaning.co.uk/gallery) | A substantial photo album includes some named cleaning subjects and many images without visible context. | Use the existing caption on every card, with a clear enlargement control. |
| [Fantastic Services — homepage](https://www.fantasticservices.com/) | Visitors can move from service choice to prices and availability, with booking steps explained separately. | Gallery quote links follow the selected service; avoid burying the next action beneath a generic social feed. |
| [Apple — iPhone](https://www.apple.com/iphone/) | Short feature headings, image-led sections and separate deeper explanations create a clear content hierarchy. | Feature one item at a generous size and keep the surrounding copy short. Retain VVE's fonts and colours. |
| [Unsplash — photo browsing](https://unsplash.com/) | Topic navigation and individual image information support browsing a large collection. | Separate service selection from media format and keep image identity/caption attached to its card. No stock photos are used. |
| [Pexels — photo and video browsing](https://www.pexels.com/) | Photos and videos have distinct entry points rather than identical unexplained tiles. | Add explicit type labels and filters; videos require an intentional Play action. No stock photos are used. |

Additional cleaning pages were found but did not return substantive content on direct opening: Techno Clean, Z Home Service, Pristine/London Carpet Cleaner, Crystal Carpet Cleaners, White Glove Pro, Green Core Waste and London Carpet Cleaning Ltd. These are not included in the 11 opened-page count or treated as fully inspected references.

## GitHub references actually read

- [VoltAgent / awesome-design-md](https://github.com/VoltAgent/awesome-design-md): reviewed the published catalogue and followed its [Apple](https://getdesign.md/apple/design-md) and [Pinterest](https://getdesign.md/pinterest/design-md) analysis pages. These are independent interpretations, not the brands' official design systems. Useful ideas are image priority and restrained hierarchy. VVE retains its own identity; we do not copy a whole brand theme or use a masonry layout that makes paired evidence difficult to compare.
- [garrytan / gstack](https://github.com/garrytan/gstack): reviewed the documented design review and browser verification approach. The useful practice is to inspect the rendered result and test the real journey after editing. No gstack tooling, code or install scripts were added.

The user's workflow, AI-chat and advertising repositories do not add a necessary gallery capability. They were not installed or represented as design research.

## What changed

1. Compact navy heading with a clear collection entry point.
2. Three service tabs with counts computed from published media and approved local entries.
3. All results / Comparisons / Photos / Videos filters, with deep links using `type=`. Empty types are not offered unless reached directly by URL.
4. A larger first item, then a generous two-column grid. Managed CRM positions retain their order and lead the collection.
5. Full, uncropped photos. Sofa comparisons use square stages to better fit portrait source images. The original before/after pairing and any “during extraction” label stay intact.
6. Local gallery clips load only after Play; Mux clips keep the existing hosted-player path. Service-page video behaviour is unchanged.
7. Full-size photo viewing, keyboard navigation, focus restoration, service quote links and 20-at-a-time loading are retained.
8. Natural, factual captions and a short explanation that individual results depend on the material and condition. No new cleaning claims, locations, prices or guarantees.

## Media publishing boundary

This redesign changes public presentation only. It reads the same `useManagedGalleryMedia` result and keeps the local manifest as fallback. No cloud settings, uploads, database records or published placements were changed. CRM access and upload readiness require the separate owner-access investigation; the new gallery layout is not proof that the live upload pipeline is working.

## Validation

- Existing gallery, lightbox, managed-reference and service-hero integration tests: **47 passed**.
- New browser-behaviour tests: **6 passed**, covering filtering, URL/history changes, before/after identity, deferred video loading, empty formats, managed ordering and pagination.
- Website TypeScript check passed after the initial implementation. Root will run final integrated type/lint/build and responsive browser verification with the other website changes before release review.

Changed implementation files: `src/pages/GalleryPage.tsx`, `src/components/gallery/GalleryResultCard.tsx`, `src/pages/GalleryPage.browsing.test.tsx`.

### Local browser evidence

The first built preview was checked independently at 375px and 1280px across all three categories. All 51 local photos/posters decoded at each width, with no horizontal overflow or uncaught page errors. Photo navigation, Escape, focus restoration, category and type filters, the empty-format return and local MP4 playback with controls passed. All remote application requests were blocked; the managed-media POST is a read RPC to the dummy local project and was blocked too. Google Fonts requests were also blocked during that pass, so those screenshots use fallback fonts.

That visual pass prompted a further mobile improvement: the intro was shortened and service tabs became a compact row, bringing the first photo forward. Managed image `sizes` now match the larger featured panel and two-column cards. Final integrated responsive verification should use the refreshed build and the existing public font assets. The final scoped lint and TypeScript checks passed.

Final refreshed-build visual pass: all three categories passed at **320px, 375px and 1280px** with Bricolage Grotesque and Inter loaded. No horizontal overflow, no page errors and both featured photos decoded in every case. On phones the first photo starts at 492px (end of tenancy/carpet) or 542px (sofa), so the actual work appears much earlier. Screenshots and the final report are in the owner's audit artifact folder under `gallery-refinement/browser/`.
