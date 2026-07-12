# Admin app — manual Supabase setup

These are one-time, manual steps in the Supabase dashboard for the project
already used by the public site. They are **not** part of any migration
because they either touch dashboard-only settings (not expressible in SQL)
or require a specific person's `auth.users` UUID, which doesn't exist until
that person's account is created.

Do these in order.

## 1. Disable public sign-up

Supabase dashboard → **Authentication → Providers → Email** → turn **off**
"Allow new users to sign up". The admin app has no sign-up page, but this is
the control that actually prevents someone from registering an account
directly against the Supabase Auth API, bypassing the app entirely.

## 2. Configure the Site URL and redirect allow-list

Supabase dashboard → **Authentication → URL Configuration**.

- **Site URL**: set to the admin app's production URL once it's deployed
  (`https://admin.vveclean.co.uk`). Until then, leave it as whatever
  placeholder Supabase requires — password-reset links won't be sent to real
  users before then anyway.
- **Redirect URLs** (add all of these — Supabase requires an exact match for
  where `resetPasswordForEmail`'s `redirectTo` is allowed to send someone):
  - `http://localhost:5174/reset-password` — local development
  - `https://<your-vercel-preview-domain>/reset-password` — the admin
    project's Vercel preview deployment URL (see `VERCEL_SETUP.md`; this
    changes per-branch unless you use a fixed preview alias, so update this
    entry when the preview URL changes)
  - `https://admin.vveclean.co.uk/reset-password` — production, once the
    subdomain is live

Do **not** add any public-site URL here — this project's redirect
allow-list is shared across the whole Supabase project, and admin recovery
links should only ever be able to land on the admin app.

## 3. Configure password requirements

Supabase dashboard → **Authentication → Policies** (or **Auth → Settings**,
depending on dashboard version) → set a minimum password length (8+
recommended) and enable "leaked password protection" if available on your
plan. The admin app's own reset-password form also enforces a client-side
minimum length as a first line of defence, but Supabase's server-side
enforcement is the one that actually matters.

## 4. Create the owner's Supabase Auth account

Supabase dashboard → **Authentication → Users → Add user** (or "Invite
user", if you'd rather they set their own password via email). Use the real
owner email. **Do not** put this email into any file in this repository —
it's account data, not configuration.

## 5. Find that user's UUID

Still on **Authentication → Users**, click the newly created user — the UUID
is shown at the top of their detail panel (also visible in the users table's
`id` column). Copy it.

## 6. Grant that account admin access

Run this in the Supabase SQL editor, replacing the placeholder with the UUID
from step 5 and a real display name:

```sql
insert into admin_users (id, display_name)
values ('00000000-0000-0000-0000-000000000000', 'Owner Name');
```

This only works after the `20260715000000_create_admin_users.sql` migration
has been applied. Until this row exists, that account can sign in via
Supabase Auth but `/api/me` will return 403 and the app will show the
"Access not authorised" screen — this is expected and correct (§9 of
`ADMIN_CRM_PLAN.md`).

## 7. Verify

1. Run the admin app locally (`npm run dev` from `admin/`, plus `vercel dev`
   if you want `/api/me` to actually respond locally — see the note in
   `VERCEL_SETUP.md`).
2. Sign in with the owner account at `/login`.
3. You should land on `/` and see "CRM dashboard foundation is ready."
4. Sign out, confirm you're returned to `/login` and the protected shell is
   no longer visible.

If you ever need a second admin, repeat steps 4–6 for that person — nothing
about `admin_users` or the app assumes a single admin.
