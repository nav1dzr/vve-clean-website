import { createClient } from '@supabase/supabase-js';

// Public media reads use a dedicated, anonymous client for the Preview media
// RPC only. The normal website client continues to use VITE_SUPABASE_* for
// quotes/contact flows, so the media Preview never repoints the website's
// primary Supabase connection.
const mediaUrl = import.meta.env.VITE_MEDIA_SUPABASE_URL as string | undefined;
const mediaAnonKey = import.meta.env.VITE_MEDIA_SUPABASE_ANON_KEY as string | undefined;

export const mediaSupabase = mediaUrl && mediaAnonKey
  ? createClient(mediaUrl, mediaAnonKey, { auth: { persistSession: false } })
  : null;
