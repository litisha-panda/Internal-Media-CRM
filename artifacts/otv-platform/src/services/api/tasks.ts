/**
 * tasks.ts — Tasks API service.
 */

import { apiFetch } from "./_client";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority: "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Closed" | "Escalated";
  dueDate: string;
  assignedTo?: number | null;
  assignedToUserId?: number | null;
  assignedDept?: string | null;
  repId?: number | null;
  clientCompany?: string | null;
  createdAt?: string;
  assignedBy?: string | null;
  assignedByName?: string | null;
  fromMeetingLog?: boolean;
  [key: string]: unknown;
}

export type TaskCreate = Omit<Task, "id"> & { id?: string };
export type TaskPatch = Partial<Task>;

interface ListResponse { ok: boolean; data: Task[] }
interface ItemResponse { ok: boolean; data: Task }

/** GET /api/tasks */
export async function listTasks(): Promise<Task[]> {
  const r = await apiFetch<ListResponse>("/api/tasks");
  return Array.isArray(r.data) ? r.data : [];
}

/** POST /api/tasks */
export async function createTask(payload: TaskCreate): Promise<Task> {
  const r = await apiFetch<ItemResponse>("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.data;
}

/** PATCH /api/tasks/:id */
export async function patchTask(id: string, patch: TaskPatch): Promise<void> {
  await apiFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/** DELETE /api/tasks/:id */
export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
}
