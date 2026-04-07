/**
 * auth.ts — Auth service: session check, login, logout, signup.
 */

import { apiFetch, authHeaders, getSessionToken, setSessionToken } from "./_client";

export { getSessionToken, setSessionToken };

export type UserRole =
  | "ADMIN"
  | "SALES REP"
  | "REGION HEAD"
  | "SALES HEAD"
  | "CRO"
  | "DIGI OPS"
  | "SALES STRATEGY";

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  region: string | null;
  repId: number | null;
  provider?: string;
}

export interface MeResponse {
  ok: boolean;
  user?: ApiUser;
  sessionToken?: string;
}

export interface LoginResponse {
  ok: boolean;
  user?: ApiUser;
  token?: string;
  error?: string;
  /** HTTP status code — injected by the client, not from the server body. */
  httpStatus?: number;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  designation?: string;
  intendedRole?: string;
  preferredRegion?: string;
}

export interface SignupResponse {
  ok: boolean;
  error?: string;
}

/** GET /api/auth/me — restore session from cookie or X-Session-Token header. */
export async function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/auth/me");
}

/**
 * POST /api/auth/login — authenticate with email + password.
 * Returns { ok, user, token, httpStatus } on success; { ok:false, error, httpStatus } on failure.
 * httpStatus is injected by this function (not from the server body) for 403 pending-approval detection.
 * Intentionally does NOT call setSessionToken — the caller decides when to persist.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json();
  return { ...data, httpStatus: r.status };
}

/**
 * POST /api/auth/logout — invalidate the server session.
 * Fire-and-forget safe: call setSessionToken(null) in the caller regardless.
 */
export async function logout(): Promise<{ ok: boolean }> {
  try {
    return await apiFetch<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      headers: authHeaders(),
    });
  } catch {
    return { ok: false };
  }
}

/** POST /api/auth/signup — register a new user account (pending admin approval). */
export async function signup(payload: SignupPayload): Promise<SignupResponse> {
  const r = await fetch("/api/auth/signup", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}
