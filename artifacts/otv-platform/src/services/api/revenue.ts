/**
 * revenue.ts — Revenue entries API service.
 * GOLDEN RULE: Revenue entries (revenueEntries) are immutable once created, except notes.
 * idempotencyKey is required on create to prevent duplicate entries.
 */

import { apiFetch } from "./_client";

export interface RevenueEntry {
  id: string;
  repId?: number | null;
  clientCompany: string;
  agencyName?: string | null;
  brand?: string | null;
  dealType: string;
  amount: number;
  invoiceRef: string;
  date: string;
  quarter: string;
  fiscalYear: string;
  notes?: string | null;
}

export interface RevenueCreatePayload {
  id?: string;
  repId?: number | null;
  clientCompany: string;
  agencyName?: string;
  brand?: string;
  dealType?: string;
  amount: number;
  invoiceRef: string;
  date: string;
  quarter?: string;
  fiscalYear?: string;
  notes?: string;
  /** Required for idempotency — use `ikey_<ts>_<rand>` format. */
  idempotencyKey: string;
}

interface ListResponse { ok: boolean; data: RevenueEntry[] }
interface ItemResponse { ok: boolean; data: RevenueEntry }

/** GET /api/revenue */
export async function listRevenue(): Promise<RevenueEntry[]> {
  const r = await apiFetch<ListResponse>("/api/revenue");
  return Array.isArray(r.data) ? r.data : [];
}

/**
 * POST /api/revenue — create a new revenue entry.
 * idempotencyKey is required; the server deduplicates on it to prevent double-posts.
 */
export async function createRevenueEntry(payload: RevenueCreatePayload): Promise<RevenueEntry> {
  const r = await apiFetch<ItemResponse>("/api/revenue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.data;
}
