# Local media review

Run from `admin/`:

```powershell
node node_modules/vite/bin/vite.js --config dev/media-review/vite.config.mjs
```

Open `http://127.0.0.1:8963/`. This renders the actual branch's media manager and website image inventory with a clearly labelled synthetic library. Authentication and every CRM API request are replaced. No credentials or environment files are read, no real files upload, and no production record can be changed.

The sample supports metadata edits, old/new comparison, publication, unpublication, publication history, restoration and unused-asset archiving. These operations update only local browser storage. They support visual interaction review and refresh persistence; they do not prove the cloud API/provider chain. Built-in website photographs may load read-only from the public website.

For a fresh fixture, remove the browser-local key `vve-synthetic-media-review-20261117` and reload. This affects only sample data.

For actual SQL transaction verification, from the repository root run:

```powershell
node scripts/validate-media-lifecycle-local.mjs --run
```

This needs the installed PostgreSQL 18 binaries at `C:/Program Files/PostgreSQL/18/bin` and an available localhost port 55478, not Docker or cloud credentials. It creates a uniquely named disposable cluster under ignored `admin/output/`, binds only to `127.0.0.1`, verifies the connected cluster directory, applies the four media migrations and runs ten lifecycle/security checks. The cluster is stopped at the end; evidence is saved in that run's `result.json`. No application connection URL is accepted.

Passing SQL checks establish publication transaction behaviour, not real R2 uploads, Mux processing or browser video playback. Keep those separately recorded provider/browser results in the audit.
