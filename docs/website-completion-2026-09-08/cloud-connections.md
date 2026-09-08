# Photo and video cloud connections — 8 September 2026

**The services are Cloudflare R2/Images for photos and Mux for video. Their saved preview configuration has been repaired. A complete upload, processing and publication round trip is still unverified because the separate test database is paused.**

## Resources verified

| Part | Observed evidence | Meaning |
|---|---|---|
| Cloudflare R2 | Private bucket `vve-media-originals`, Western Europe, created 31 August; dashboard shows 0 objects / 0 B. Public development access is disabled and no custom domain is assigned. | The originals store exists and is private. No completed upload was present at inspection; earlier attempted or deleted uploads cannot be inferred. |
| Image Worker | `vve-media-preview` at `https://vve-media-preview.navidz7111.workers.dev`, with `IMAGES` and `MEDIA_ORIGINALS` bound to the expected bucket. | The declared bindings are correct. A synthetic missing-image GET returned the expected 404; a real JPG/HEIC transformation has not been tested. |
| Mux | Organisation **vve limited**, environment **website** (`2httc6`), displays its first-upload screen with no uploaded assets. | The environment exists. Successful upload, encode and playback are not established. |
| Mux tokens | Two non-revoked Video entries, `vve-media-preview-video` and `vve-media-preview-video-replacement`, dated 1 September. | Credentials were created. Their exact match to the deployed credential, permissions and authentication remain unverified. No token was revealed, copied, created or revoked. |

Evidence came from signed-in dashboards and Vercel environment metadata. No customer media or database rows were read, uploaded or deleted. No credential, signed upload URL or build-hook secret is included here.

## Configuration repairs completed

### Vercel preview scope

All seven media settings previously belonged only to Preview branch `codex/restore-crm-media-isolation`. They now belong to Preview branch **`feature/website-final-completion`** on CRM project `prj_cbvjxsfx6AuplVihMi4GwEC7sqFO`, team `team_QIgTuMMEB0fc4JEf1SmmkUbB`.

| Existing record ID | Setting | Preserved type |
|---|---|---|
| `UkgU3VLn7AM7ya7Y` | `CLOUDFLARE_MEDIA_ORIGIN` | encrypted |
| `mxEkqn2B7rNDRG99` | `CLOUDFLARE_ACCOUNT_ID` | sensitive |
| `gJJwuzP0XuBZkLJC` | `R2_BUCKET_NAME` | sensitive |
| `epNDMOHaY79ADfPH` | `R2_ACCESS_KEY_ID` | sensitive |
| `UtUKEpVzPJg9gT56` | `R2_SECRET_ACCESS_KEY` | sensitive |
| `01gXk6H8uC8GivME` | `MUX_TOKEN_ID` | sensitive |
| `DpIi9jpj4W0zaIqG` | `MUX_TOKEN_SECRET` | sensitive |

Record identity, type, old branch and absence of conflicting destination entries were checked first. Each update included only:

```json
{"target":["preview"],"gitBranch":"feature/website-final-completion"}
```

Stored values, keys and types were omitted from the updates. Each response and a final independent metadata listing confirmed all seven types and the exact Preview-only branch scope. Production and unscoped Preview variables were unchanged.

This retargets existing entries, without copying them. Future deployments of the old restore branch no longer receive those branch-specific entries; existing deployments retain their captured settings. Rollback restores `gitBranch` to `codex/restore-crm-media-isolation`, keeping `target: ["preview"]`. See the [environment edit API](https://vercel.com/docs/rest-api/projects/edit-an-environment-variable) and [environment lifecycle](https://vercel.com/docs/environment-variables/managing-environment-variables).

### R2 browser upload permissions

The original rule allowed only the old `codex/media-system` CRM preview and lacked the new uploader's conditional header. It was updated in the signed-in Cloudflare dashboard, saved and reopened to verify the full persisted value:

```json
[
  {
    "AllowedOrigins": [
      "https://vve-clean-crm-git-codex-media-system-nav1dzrs-projects.vercel.app",
      "https://vve-clean-crm-git-feature-website-fina-06f923-nav1dzrs-projects.vercel.app"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "If-None-Match"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

The stable completion-preview origin came from READY CRM deployment `dpl_A6Ygi7sxubw4biiYaW885qaSNRS9` at commit `a0c1c31767deea6c718bc261bd789f2826ceaee7`. The old origin, PUT method, exposed ETag and one-hour preflight cache were preserved. Only the current CRM preview origin and `If-None-Match` were added. The header supports protection against overwriting an existing original.

No wildcard, public bucket access, production hostname or DNS change was introduced. Rollback removes only the added origin and `If-None-Match`, preserving the other fields above.

### Mux browser policy

Commit `8ec7415` adds Mux's documented direct-upload destination, `https://storage.googleapis.com`, to the CRM connection policy. Without it, the browser can stop transfers before progress advances. Other directives are preserved and two configuration tests cover the change. See [Mux CSP guidance](https://www.mux.com/docs/core/content-security-policy) and [deployment verification](deployment-isolation-readiness.md).

## Remaining connection checks

1. Resume and inspect **VVE TEST**, or establish another explicitly selected isolated database. Supabase blocks resume at the owner's two-active-free-project limit; both active projects are in use. See [database connections](database-connections.md).
2. Configure that database for both previews, apply the migrations and select the test destinations required by [preview isolation](deployment-isolation-readiness.md). The approval marker has not been enabled. Provider environment entries alone do not allow preview writes.
3. Confirm existing R2 and Mux credentials through the deployed application. Vercel's targeted sensitive-token read returned no value and `decrypted: false`; no secret recovery or full environment pull was attempted.
4. Use synthetic or owner-approved files to test JPG, HEIC and MOV upload; progress/cancel/retry; Worker output; Mux processing/playback; shared numbered positions; before/after replacement; rollback and archive protection. Follow [media setup](../../admin/MEDIA_SYSTEM_SETUP.md).

The old media branch's stale database override is separate from the repaired provider settings. Current CRM and media records need one verified test database. No active database should be merged or repurposed on the basis of its name.

Mismatched preview scopes, incomplete R2 permissions and the Mux browser policy were concrete faults found and corrected. They do not prove the exact cause of the owner's historical stuck upload, whose failed request was unavailable. Code and isolated PostgreSQL checks are recorded in [media validation](media-validation.md). No new subscription or replacement media account has been shown necessary. No real upload is claimed complete.
