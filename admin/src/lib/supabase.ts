import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Browser client — anon key only. This is the only Supabase client that ever
// runs in the browser, and it is used exclusively for Supabase Auth (login,
// session, password reset). It must never be used to query `bookings` or any
// other table directly — see ADMIN_CRM_PLAN.md §10.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
