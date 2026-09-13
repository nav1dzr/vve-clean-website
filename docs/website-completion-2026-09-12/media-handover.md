# Website media handover

The website now connects the carpet, sofa and end-of-tenancy hero photographs to their existing published result positions. Replacing a shared source can update the hero, service results and gallery without editing those pages. The homepage keeps its own independent hero position.

The public mapping is implemented and tested with simulated published replacements. Actual CRM uploading, processing and publishing have not been re-tested end to end in this phase. The existing cloud setup, including the earlier 8 September fixes, remains the starting point for that connected check. No upload, provider or database configuration was changed here.

| Existing reference | Website use | Maintenance note |
|---|---|---|
| `gallery-carpet` | Carpet gallery category; first position can supply the carpet hero if no service-results assignment is published | Complete before/after pair, photo or video, with a carpet-specific title and description. |
| `gallery-sofa` | Sofa/upholstery gallery category; first position can supply the sofa hero if no service-results assignment is published | Use matching furniture/fabric work. |
| `gallery-end-of-tenancy` | EOT gallery category; first position can supply the EOT hero if no service-results assignment is published | Use property, kitchen and bathroom work; paired views should be the same job. |
| `carpet-main-results` | Carpet service results and the first-choice source for its hero | Its first assigned published result controls the hero photograph. Reuse the intended carpet gallery source here. |
| `sofa-main-results` | Sofa service results and the first-choice source for its hero | Its first assigned published result controls the hero photograph. Reuse the intended sofa gallery source here. |
| `end-of-tenancy-main-results` | EOT service results and the first-choice source for its hero | Its first assigned published result controls the hero photograph. Reuse the intended EOT gallery source here. |
| `homepage-hero-image` | Homepage primary photograph | Managed photo first; existing carpet-extraction image is the fallback. |
| `homepage-equipment-image` | Homepage equipment section | Existing equipment reference; not a generic service-result slot. |

These are existing public reference names, not new CRM fields. They do not prove that each position is currently assigned or published successfully. Curated local proof and guide images still exist separately; this change does not make every website image editable through one CRM position.

## How the first position works

For each service, the website takes the first published assignment in its `*-main-results` reference. Only when that reference has no published assignment does it look at the first assignment in the matching `gallery-*` reference. “First” means published `sort_order`, with `reference_key` as a stable tie-breaker; it does not randomly choose a photograph or always assume a particular code such as `BA01`.

- **Photo:** the hero uses that photo, its published title as the caption, and its image description as alternative text. An empty title falls back to the position label, so add a useful title when publishing.
- **Complete before/after pair:** the hero uses the after photo and its description. Both halves remain available in the assigned results/gallery placement.
- **Video:** the hero keeps its curated local photograph. The clip remains available in the results/gallery with user-controlled playback.
- **Incomplete pair or missing image in the selected position:** the hero keeps its curated local photograph. An incomplete pair is withheld from the managed results/gallery.
- **Neither reference has a published assignment:** the hero keeps its curated local photograph.
- **Image fails to load:** the hero switches to its local photograph and matching caption. If that also fails, it shows a gallery link instead of a broken image.

A returned first assignment that is a video or incomplete pair does not cause the hero to jump to a later result or the gallery fallback. To choose another hero, change the first published assignment. The local fallbacks remain the carpet-extraction image, sofa-cleaning action image and EOT kitchen-hob result. A managed EOT standalone photo is not described as a before/after pair.

Published changes are read on the next page load or when the website window regains focus. There is no continuous live-update subscription. A failed refresh keeps the last successfully read references; a successfully returned empty feed removes the managed selection and restores the local hero.

## Replacing a shared photograph

Prepare the service, photo or video type, a useful title and image description, and any matching before/after partner. Choose a genuine photograph or complete pair for the first service-results position if you want the hero to change. Put a video in a later position if you want to retain a managed hero photograph.

Once the connected publishing workflow is verified:

1. Upload the asset and wait for processing to finish. Pair the before and after photos from the same job.
2. Assign the source to the intended gallery position and reuse that same source in the service-results position. Uploading a second copy is unnecessary.
3. Place the intended hero source first in that service’s published results order. Keep the homepage hero separate through `homepage-hero-image`.
4. Preview the title, description and mobile crop, then publish.
5. Reload or refocus the website. Check the service hero, assigned results and correct gallery category. Confirm that each shows the new asset and its matching caption.

If only the gallery source is assigned, its first published result can supply the hero as described above; it does not automatically create a new service-results assignment. Adding a new photo elsewhere in the gallery does not replace an already assigned service hero.

## What has been verified

Local tests simulate replacement of a published source for all three services and verify that the hero, service results and actual gallery page update together. They also cover actual service-page wiring, stable ordering, gallery fallback, complete and incomplete pairs, videos, failed images, replacement after failure, and removal of published media. These tests use the existing public-reference response shape; they do not upload to a cloud account or publish from the CRM.

The remaining connected check must prove upload progress, processing completion, before/after pairing, source reuse, publishing, failed-upload recovery and delivery to every assigned placement. CRM upload readiness remains unconfirmed until that check passes. No new provider or Supabase project is required by this website mapping alone.

## Replacement list

| Area | Current assessment | Best next asset |
|---|---|---|
| Homepage | USABLE FOR NOW | A sharp, well-lit genuine carpet-cleaning action image with room for mobile cropping. |
| EOT hero/results | USABLE FOR NOW | A stronger finished kitchen or bathroom plus its genuine matching before image. The current hob image is usable but shows wear. |
| Carpet/sofa results | USABLE FOR NOW | Strong matching pairs and short process clips; retain realistic stain limitations. |
| Guides | Text method complete; step imagery MISSING | Real photos showing each approved cleaning stage, with short descriptions. |
| After-builders/commercial | Dedicated proof MISSING | Genuine matching jobs; no unrelated EOT or household sofa proof added to fill space. |
| Local pages | General work usable; stronger local proof MISSING | Confirmed-area jobs, with permission to describe their approximate area. Do not invent local attribution. |
| About | Genuine story available; approved team photo MISSING | Real team photograph and confirmed public names/roles. |

Keep original files outside the deployable folder. Record service, slot, before/after role, caption, crop and permission. Avoid customer names, identifying interiors and house numbers without permission. Optimise images for mobile delivery and use poster images with user-controlled video playback. Keep important words in page text, not embedded in pictures.
