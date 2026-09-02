import { createClient } from '@supabase/supabase-js';

// Public media reads use a dedicated, anonymous CRM-media client for the
// narrowly scoped public_media_references RPC only. The normal website client
// remains untouched for quotes/contact flows.
const mediaUrl = import.meta.env.VITE_MEDIA_SUPABASE_URL as string | undefined;
const mediaAnonKey = import.meta.env.VITE_MEDIA_SUPABASE_ANON_KEY as string | undefined;

export const mediaSupabase = mediaUrl && mediaAnonKey
  ? createClient(mediaUrl, mediaAnonKey, { auth: { persistSession: false } })
  : null;
