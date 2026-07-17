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

// A hung connection (e.g. a dead network with no OS-level reset) would
// otherwise never resolve or reject, leaving a page stuck on its loading
// state forever. This bounds every request so it always eventually
// surfaces as a catchable, retryable error.
const REQUEST_TIMEOUT_MS = 20_000;

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'The request timed out. Check your connection and try again.');
    }
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }

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

// Same auth/timeout handling as authFetch(), but for a binary response
// (the invoice PDF preview endpoint) rather than JSON — authFetch() always
// calls res.json(), which would silently discard a PDF response body.
// Used only for GET /api/invoices/:id/preview; the download/send flows use
// authFetch() as normal since those endpoints return JSON (a signed URL,
// or a send confirmation), never raw bytes.
export async function authFetchBlob(path: string): Promise<Blob> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, { headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'The request timed out. Check your connection and try again.');
    }
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let message = 'Request failed';
    try {
      const body: unknown = await res.json();
      if (isErrorBody(body) && typeof body.error === 'string') message = body.error;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(res.status, message);
  }

  return res.blob();
}
