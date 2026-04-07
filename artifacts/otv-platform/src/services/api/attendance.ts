/**
 * attendance.ts — Attendance records and exception requests API service.
 */

import { apiFetch } from "./_client";

export interface AttendanceRecord {
  id: string;
  repId: number;
  date: string;
  present: boolean;
  checkedInAt?: string | null;
  lateFlag?: boolean;
  [key: string]: unknown;
}

export interface AttendanceException {
  id: string;
  repId?: number | null;
  date: string;
  reason: string;
  notes?: string | null;
  status?: string;
  attendanceRecordId?: string | null;
  [key: string]: unknown;
}

export interface ExceptionCreate {
  date: string;
  reason: string;
  notes?: string;
  attendanceRecordId?: string;
}

interface RecordsResponse   { ok: boolean; data: AttendanceRecord[] }
interface ExceptionsResponse { ok: boolean; data: AttendanceException[] }

/** GET /api/attendance-records */
export async function listAttendanceRecords(): Promise<AttendanceRecord[]> {
  const r = await apiFetch<RecordsResponse>("/api/attendance-records");
  return Array.isArray(r.data) ? r.data : [];
}

/** GET /api/attendance-exceptions */
export async function listAttendanceExceptions(): Promise<AttendanceException[]> {
  const r = await apiFetch<ExceptionsResponse>("/api/attendance-exceptions");
  return Array.isArray(r.data) ? r.data : [];
}

/** GET both records and exceptions in parallel. */
export async function listAll(): Promise<{
  records: AttendanceRecord[];
  exceptions: AttendanceException[];
}> {
  const [records, exceptions] = await Promise.all([
    listAttendanceRecords(),
    listAttendanceExceptions(),
  ]);
  return { records, exceptions };
}

/** POST /api/attendance-exceptions — submit an exception request. */
export async function createException(payload: ExceptionCreate): Promise<AttendanceException> {
  const r = await apiFetch<{ ok: boolean; data: AttendanceException }>("/api/attendance-exceptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.data;
}

/** POST /api/attendance-records/:id/grant-exception */
export async function grantException(recordId: string, reason: string): Promise<void> {
  await apiFetch(`/api/attendance-records/${recordId}/grant-exception`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

/** POST /api/attendance/simulate-eod — HR dev tool to trigger end-of-day check. */
export async function simulateEod(): Promise<void> {
  await apiFetch("/api/attendance/simulate-eod", { method: "POST" });
}
