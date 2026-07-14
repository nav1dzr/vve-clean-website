import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ErrorBody {
  error?: unknown;
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value;
}

// Every admin data fetch goes through this — attaches the current Supabase
// session's access token as a Bearer header, matching what every admin API
// route requires (ADMIN_CRM_PLAN.md §8-9). Never called before a session
// exists, since RequireAuth blocks rendering of any component that would
// call this until status === 'authenticated'.
export async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, { ...init, headers });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message = isErrorBody(body) && typeof body.error === 'string' ? body.error : 'Request failed';
    throw new ApiError(res.status, message);
  }

  return body as T;
}
