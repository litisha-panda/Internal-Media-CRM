/**
 * deals.ts — Deals API service.
 * GOLDEN RULE: pipeline value is computed at read time (amount × STAGE_PROB[stage] / 100).
 * It is NEVER stored. Only raw `amount` and `stage` are persisted.
 */

import { apiFetch } from "./_client";

export interface Deal {
  id: string;
  repId?: number | null;
  clientCompany: string;
  dealType: string;
  stage: string;
  amount: number;
  region?: string | null;
  fiscalYear?: string | null;
  quarter?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export type DealPatch = Partial<Deal>;

interface ListResponse { ok: boolean; data: Deal[] }
interface ItemResponse { ok: boolean; data: Deal }

/** GET /api/deals */
export async function listDeals(): Promise<Deal[]> {
  const r = await apiFetch<ListResponse>("/api/deals");
  return Array.isArray(r.data) ? r.data : [];
}

/** PATCH /api/deals/:id */
export async function patchDeal(id: string, patch: DealPatch): Promise<void> {
  await apiFetch(`/api/deals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
