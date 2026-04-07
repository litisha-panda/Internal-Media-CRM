/**
 * touchpoints.ts — Touchpoints API service.
 * Immutable fields: repId, region, date, touchpointType.
 * Mutable fields: whatHappened, clientFeedback, stageUpdate, actionItems, notes.
 */

import { apiFetch } from "./_client";

export interface ActionItem {
  action: string;
  neededFrom: string;
  dueDate: string;
  notes?: string;
}

export interface Touchpoint {
  id: string;
  repId: number | null;
  region: string;
  date: string;
  touchpointType: string;
  whatHappened?: string | null;
  clientFeedback?: string | null;
  stageUpdate?: string | null;
  actionItems?: ActionItem[];
  notes?: string | null;
  [key: string]: unknown;
}

export type TouchpointCreate = Omit<Touchpoint, "id"> & { id?: string };
export type TouchpointPatch = Pick<Touchpoint, "whatHappened" | "clientFeedback" | "stageUpdate" | "actionItems" | "notes">;

interface ListResponse { ok: boolean; data: Touchpoint[] }
interface ItemResponse { ok: boolean; data: Touchpoint }

/** GET /api/touchpoints */
export async function listTouchpoints(): Promise<Touchpoint[]> {
  const r = await apiFetch<ListResponse>("/api/touchpoints");
  return Array.isArray(r.data) ? r.data : [];
}

/** POST /api/touchpoints */
export async function createTouchpoint(payload: TouchpointCreate): Promise<Touchpoint> {
  const r = await apiFetch<ItemResponse>("/api/touchpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.data;
}

/** PATCH /api/touchpoints/:id — only mutable fields are accepted by the server. */
export async function patchTouchpoint(id: string, patch: Partial<TouchpointPatch>): Promise<void> {
  await apiFetch(`/api/touchpoints/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
