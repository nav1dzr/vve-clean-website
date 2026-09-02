// Reusable server-side authentication/authorisation helper for every admin
// API route. Holds the only code path in this app that touches the
// service-role key — never imported from admin/src/.

import { getCrmAuthClient, getServiceClient } from './supabaseAdmin.js';
import { isMediaPreview } from './env.js';
import { MEDIA_ADMINS_TABLE } from './mediaTables.js';

function extractBearerToken(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

// Verifies the caller's Supabase access token and confirms the resulting
// user is present in admin_users.
//
// Returns one of:
//   { ok: true, admin: { id, email, displayName } }
//   { ok: false, status: 401, error }   — missing/invalid/expired token
//   { ok: false, status: 403, error }   — valid account, not an admin
//   { ok: false, status: 500, error }   — server misconfigured / lookup failed
//
// The 500 branch never includes which env var is missing or any internal
// detail in the response body — only a generic message. Details are logged
// server-side only.
export async function verifyAdminRequest(req) {
  // On the dedicated media Preview, non-media CRM routes are intentionally
  // unavailable. This guarantees a CRM token can never cause those routes to
  // query the temporary VVE OS project.
  if (isMediaPreview()) {
    return { ok: false, status: 403, error: 'CRM routes are unavailable on the media Preview' };
  }
  return verifyAdminRequestForTable(req, 'admin_users');
}

// The temporary VVE OS Preview database has no shared CRM allow-list. Media
// routes use a dedicated, empty-by-default allow-list created by the Preview
// media migration. This keeps authorisation isolated without changing VVE OS
// tables, policies, or auth configuration.
export async function verifyMediaAdminRequest(req) {
  if (isMediaPreview()) return verifyMediaPreviewAdminRequest(req);
  return verifyAdminRequestForTable(req, MEDIA_ADMINS_TABLE);
}

// Preview-only bridge: authenticate against the CRM project, then allow only
// the explicitly configured CRM administrator into /media. VVE OS Auth is
// never consulted and its Auth settings are never changed.
async function verifyMediaPreviewAdminRequest(req) {
  const token = extractBearerToken(req);
  if (!token) return { ok: false, status: 401, error: 'Missing bearer token' };

  const allowedEmail = (process.env.MEDIA_PREVIEW_ADMIN_EMAIL || '').trim().toLowerCase();
  const crmAuth = getCrmAuthClient();
  if (!allowedEmail || !crmAuth) {
    return { ok: false, status: 500, error: 'Server misconfiguration' };
  }

  const { data: userData, error: userErr } = await crmAuth.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return { ok: false, status: 401, error: 'Invalid or expired token' };
  if ((user.email || '').trim().toLowerCase() !== allowedEmail) {
    return { ok: false, status: 403, error: 'Not an authorised media admin' };
  }

  return {
    ok: true,
    admin: {
      id: user.id,
      email: user.email || '',
      displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'CRM admin',
    },
  };
}

async function verifyAdminRequestForTable(req, adminTable) {
  const supabase = getServiceClient();
  if (!supabase) {
    return { ok: false, status: 500, error: 'Server misconfiguration' };
  }

  const token = extractBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Missing bearer token' };
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }

  const user = userData.user;

  const { data: adminRow, error: adminErr } = await supabase
    .from(adminTable)
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (adminErr) {
    console.error('[admin/api] admin allow-list lookup failed:', adminErr.code, adminErr.message);
    return { ok: false, status: 500, error: 'Authorisation check failed' };
  }

  if (!adminRow) {
    return { ok: false, status: 403, error: 'Not an authorised admin' };
  }

  return {
    ok: true,
    admin: {
      id: user.id,
      email: user.email || '',
      displayName: adminRow.display_name,
    },
  };
}
