/**
 * useAttendance — Fetch and mutate attendance records and exceptions.
 *
 * Fetches both records and exceptions in parallel on explicit `refresh()` call
 * (callers decide when to load — e.g. when the HR view is opened).
 * All mutations are optimistic: local state is applied immediately and
 * reverted via refetch on server error.
 */

import { useState, useCallback } from "react";
import * as attendSvc from "../services/api/attendance";
import type {
  AttendanceRecord,
  AttendanceException,
  ExceptionCreate,
} from "../services/api/attendance";

export interface UseAttendanceReturn {
  records: AttendanceRecord[];
  exceptions: AttendanceException[];
  isLoading: boolean;
  refresh: () => void;
  grantException: (recordId: string, reason: string) => Promise<void>;
  createException: (payload: ExceptionCreate) => Promise<AttendanceException>;
  patchException: (
    exceptionId: string,
    patch: Partial<Pick<AttendanceException, "notes" | "status">>
  ) => Promise<AttendanceException>;
  simulateEod: () => Promise<void>;
}

export function useAttendance(): UseAttendanceReturn {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [exceptions, setExceptions] = useState<AttendanceException[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(() => {
    setIsLoading(true);
    attendSvc.listAll()
      .then(({ records: recs, exceptions: excs }) => {
        setRecords(recs);
        setExceptions(excs);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const grantException = useCallback(
    async (recordId: string, reason: string): Promise<void> => {
      // Optimistic: mark the record as excused locally
      setRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, excused: true, excuseReason: reason } : r)
      );
      try {
        await attendSvc.grantException(recordId, reason);
        refresh();
      } catch (err) {
        refresh(); // revert via server truth
        throw err;
      }
    },
    [refresh],
  );

  const createException = useCallback(
    async (payload: ExceptionCreate): Promise<AttendanceException> => {
      // Optimistic: append a placeholder exception
      const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const optimistic = { ...payload, id: tempId, status: "pending" } as AttendanceException;
      setExceptions(prev => [...prev, optimistic]);
      try {
        const created = await attendSvc.createException(payload);
        setExceptions(prev => prev.map(e => e.id === tempId ? created : e));
        return created;
      } catch (err) {
        setExceptions(prev => prev.filter(e => e.id !== tempId));
        throw err;
      }
    },
    [],
  );

  const patchException = useCallback(
    async (
      exceptionId: string,
      patch: Partial<Pick<AttendanceException, "notes" | "status">>
    ): Promise<AttendanceException> => {
      // Optimistic: apply patch locally immediately
      setExceptions(prev =>
        prev.map(e => e.id === exceptionId ? { ...e, ...patch } : e)
      );
      try {
        const updated = await attendSvc.patchException(exceptionId, patch);
        setExceptions(prev =>
          prev.map(e => e.id === exceptionId ? { ...e, ...updated } : e)
        );
        return updated;
      } catch (err) {
        refresh(); // revert via server truth
        throw err;
      }
    },
    [refresh],
  );

  const simulateEod = useCallback(async (): Promise<void> => {
    await attendSvc.simulateEod();
    refresh();
  }, [refresh]);

  return {
    records,
    exceptions,
    isLoading,
    refresh,
    grantException,
    createException,
    patchException,
    simulateEod,
  };
}
