import { createClient } from '@supabase/supabase-js';

// Public media reads use a dedicated, anonymous CRM-media client for the
// narrowly scoped public_media_references RPC only. The normal website client
// remains untouched for quotes/contact flows.
// A media-specific public client may be configured for an isolated Preview,
// but the normal CRM public client is the safe fallback when Media lives in
// that same project.  This client is still used only for the single resolved
// public_media_references RPC below; it never reads CRM tables directly.
const mediaUrl = (import.meta.env.VITE_MEDIA_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL) as string | undefined;
const mediaAnonKey = (import.meta.env.VITE_MEDIA_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const mediaSupabase = mediaUrl && mediaAnonKey
  ? createClient(mediaUrl, mediaAnonKey, { auth: { persistSession: false } })
  : null;
