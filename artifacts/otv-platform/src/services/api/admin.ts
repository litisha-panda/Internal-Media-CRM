/**
 * admin.ts — Admin API service: user management, invites, exports.
 */

import { apiFetch } from "./_client";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  region: string | null;
  repId: number | null;
  managerId: string | null;
  status: string;
  requestedAt?: string;
  [key: string]: unknown;
}

export interface RepProfilePatch {
  region?: string;
  reportingManager?: string;
}

interface UsersResponse { ok: boolean; users?: AdminUser[]; data?: AdminUser[] }

/** GET /api/admin/users */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const r = await apiFetch<UsersResponse>("/api/admin/users");
  const list = r.users ?? r.data ?? [];
  return Array.isArray(list) ? list : [];
}

/** POST /api/admin/users/:id/approve */
export async function approveUser(id: string, role: string, region: string): Promise<void> {
  await apiFetch(`/api/admin/users/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, region }),
  });
}

/** POST /api/admin/users/:id/reject */
export async function rejectUser(id: string): Promise<void> {
  await apiFetch(`/api/admin/users/${id}/reject`, { method: "POST" });
}

/** PATCH /api/users/:id — update role, managerId, or status (with audit log) */
export async function patchUser(
  id: string,
  patch: { role?: string; managerId?: string | null; status?: string },
): Promise<void> {
  await apiFetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/** DELETE /api/admin/users/:id — revoke (soft-delete) */
export async function deleteUser(id: string): Promise<void> {
  await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
}

/** POST /api/auth/invite — generate a 72-hour single-use invite link */
export async function createInvite(email: string): Promise<{ inviteUrl: string; expiresAt: string }> {
  const r = await apiFetch<{ ok: boolean; inviteUrl: string; expiresAt: string }>(
    "/api/auth/invite",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
  return r;
}

/**
 * PATCH /api/admin/reps/:repId — update a rep's region and/or reporting manager.
 */
export async function patchRepProfile(repId: number, patch: RepProfilePatch): Promise<void> {
  await apiFetch(`/api/admin/reps/${repId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
