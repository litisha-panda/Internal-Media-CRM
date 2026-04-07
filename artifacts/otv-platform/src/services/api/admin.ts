/**
 * admin.ts — Admin API service: user management and rep profile updates.
 */

import { apiFetch } from "./_client";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  region: string | null;
  repId: number | null;
  status?: string;
  _apiId?: number;
  [key: string]: unknown;
}

export interface RepProfilePatch {
  region?: string;
  reportingManager?: string;
}

interface UsersResponse { ok: boolean; data: AdminUser[] }

/** GET /api/admin/users */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const r = await apiFetch<UsersResponse>("/api/admin/users");
  return Array.isArray(r.data) ? r.data : [];
}

/** POST /api/admin/users/:id/approve */
export async function approveUser(apiId: number, role: string, region: string): Promise<void> {
  await apiFetch(`/api/admin/users/${apiId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, region }),
  });
}

/** POST /api/admin/users/:id/reject */
export async function rejectUser(apiId: number): Promise<void> {
  await apiFetch(`/api/admin/users/${apiId}/reject`, { method: "POST" });
}

/** PATCH /api/admin/users/:id/role */
export async function patchUserRole(apiId: number, role: string, region: string): Promise<void> {
  await apiFetch(`/api/admin/users/${apiId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, region }),
  });
}

/** DELETE /api/admin/users/:id */
export async function deleteUser(apiId: number): Promise<void> {
  await apiFetch(`/api/admin/users/${apiId}`, { method: "DELETE" });
}

/**
 * PATCH /api/admin/reps/:repId — update a rep's region and/or reporting manager.
 * Authorization: SALES REP (own only), REGION HEAD (scoped), ADMIN (any).
 */
export async function patchRepProfile(repId: number, patch: RepProfilePatch): Promise<void> {
  await apiFetch(`/api/admin/reps/${repId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
