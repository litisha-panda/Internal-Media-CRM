/**
 * internalRequests.ts — Internal Requests (IRs) API service.
 */

import { apiFetch } from "./_client";

export interface InternalRequest {
  id: string;
  title: string;
  description?: string | null;
  priority: "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  dueDate?: string | null;
  requestedBy?: string | null;
  requestedByUserId?: number | null;
  assignedDept?: string | null;
  repId?: number | null;
  clientCompany?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export type IRCreate = Omit<InternalRequest, "id"> & { id?: string };
export type IRPatch = Partial<InternalRequest>;

interface ListResponse { ok: boolean; data: InternalRequest[] }
interface ItemResponse { ok: boolean; data: InternalRequest }

/** GET /api/internal-requests */
export async function listIRs(): Promise<InternalRequest[]> {
  const r = await apiFetch<ListResponse>("/api/internal-requests");
  return Array.isArray(r.data) ? r.data : [];
}

/** POST /api/internal-requests */
export async function createIR(payload: IRCreate): Promise<InternalRequest> {
  const r = await apiFetch<ItemResponse>("/api/internal-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.data;
}

/** PATCH /api/internal-requests/:id */
export async function patchIR(id: string, patch: IRPatch): Promise<void> {
  await apiFetch(`/api/internal-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/** POST /api/internal-requests/:id/accept */
export async function acceptIR(id: string): Promise<void> {
  await apiFetch(`/api/internal-requests/${id}/accept`, { method: "POST" });
}

/** POST /api/internal-requests/:id/in-progress */
export async function markInProgress(id: string): Promise<void> {
  await apiFetch(`/api/internal-requests/${id}/in-progress`, { method: "POST" });
}

/** POST /api/internal-requests/:id/resolve */
export async function resolveIR(id: string, note?: string): Promise<void> {
  await apiFetch(`/api/internal-requests/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

/** POST /api/internal-requests/:id/reject */
export async function rejectIR(id: string, note?: string): Promise<void> {
  await apiFetch(`/api/internal-requests/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

/** POST /api/internal-requests/:id/withdraw */
export async function withdrawIR(id: string): Promise<void> {
  await apiFetch(`/api/internal-requests/${id}/withdraw`, { method: "POST" });
}
