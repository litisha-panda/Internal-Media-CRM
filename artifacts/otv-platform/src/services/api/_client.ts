/**
 * _client.ts — Shared fetch infrastructure for the OTV API service layer.
 *
 * Replit's path-based proxy prevents httpOnly cookies from being forwarded
 * reliably. We store the session token in localStorage and send it as the
 * X-Session-Token header on all API requests. The server accepts either the
 * cookie OR this header.
 */

const SESSION_TOKEN_KEY = "otv_session_token";

export function getSessionToken(): string | null {
  try { return localStorage.getItem(SESSION_TOKEN_KEY); } catch { return null; }
}

export function setSessionToken(t: string | null): void {
  try {
    t ? localStorage.setItem(SESSION_TOKEN_KEY, t)
      : localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const t = getSessionToken();
  return { ...(t ? { "X-Session-Token": t } : {}), ...extra };
}

/** Generic error from a failed API call. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Core fetch wrapper: adds auth headers + credentials, throws ApiError on
 * non-2xx responses.  Always returns the parsed JSON body.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const merged: RequestInit = {
    credentials: "include",
    ...opts,
    headers: authHeaders((opts.headers ?? {}) as Record<string, string>),
  };
  const r = await fetch(path, merged);
  if (!r.ok) {
    const body = await r.json().catch(() => ({})) as { error?: string };
    throw new ApiError(
      body.error ?? `HTTP ${r.status}`,
      r.status,
      body,
    );
  }
  return r.json() as Promise<T>;
}
