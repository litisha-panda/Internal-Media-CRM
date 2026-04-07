/**
 * useAttendance — Fetch and mutate attendance records and exceptions.
 *
 * Fetches both records and exceptions in parallel on explicit `refresh()` call
 * (callers decide when to load — e.g. when the HR view is opened).
 * Exposes records, exceptions, isLoading, createException, patchException.
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
      await attendSvc.grantException(recordId, reason);
      refresh();
    },
    [refresh],
  );

  const createException = useCallback(
    async (payload: ExceptionCreate): Promise<AttendanceException> => {
      const created = await attendSvc.createException(payload);
      setExceptions(prev => [...prev, created]);
      return created;
    },
    [],
  );

  const patchException = useCallback(
    async (
      exceptionId: string,
      patch: Partial<Pick<AttendanceException, "notes" | "status">>
    ): Promise<AttendanceException> => {
      const updated = await attendSvc.patchException(exceptionId, patch);
      setExceptions(prev =>
        prev.map(e => e.id === exceptionId ? { ...e, ...updated } : e)
      );
      return updated;
    },
    [],
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
