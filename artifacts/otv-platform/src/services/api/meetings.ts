/**
 * meetings.ts — Meetings API service.
 * Status values: "planned" | "logged" | "missed" | "cancelled"
 */

import { apiFetch } from "./_client";

export interface Meeting {
  id: string;
  repId: number | null;
  region: string;
  date: string;
  time: string;
  meetingKind: string;
  agencyName: string;
  clientName: string;
  brandName: string;
  contactName: string;
  contactPhone?: string | null;
  mode: string;
  agenda: string;
  status: "planned" | "logged" | "missed" | "cancelled";
  touchpointId?: string | null;
  userId?: number | null;
  [key: string]: unknown;
}

export type MeetingCreate = Omit<Meeting, "id"> & { id?: string };
export type MeetingPatch = Partial<Meeting>;

interface ListResponse { ok: boolean; data: Meeting[] }
interface ItemResponse { ok: boolean; data: Meeting }

/** GET /api/meetings */
export async function listMeetings(): Promise<Meeting[]> {
  const r = await apiFetch<ListResponse>("/api/meetings");
  return Array.isArray(r.data) ? r.data : [];
}

/** POST /api/meetings */
export async function createMeeting(payload: MeetingCreate): Promise<Meeting> {
  const r = await apiFetch<ItemResponse>("/api/meetings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.data;
}

/** PATCH /api/meetings/:id */
export async function patchMeeting(id: string, patch: MeetingPatch): Promise<void> {
  await apiFetch(`/api/meetings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
