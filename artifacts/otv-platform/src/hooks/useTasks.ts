/**
 * useTasks — Fetch and mutate tasks via the tasks service.
 *
 * Behaviorally identical to useApiEntityState (tasks domain):
 *   - localStorage seed for instant first-paint (stale-while-revalidate)
 *   - Fetches on mount; polls every 30s for multi-user consistency
 *   - 401 after a valid session fires window "otv:unauthorized" event
 *   - API-syncing setter: new items POST-ed, changed items PATCH-ed
 *   - Optimistic typed helpers: createTask, patchTask, deleteTask
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as tasksSvc from "../services/api/tasks";
import type { Task, TaskCreate, TaskPatch } from "../services/api/tasks";

const LOCAL_KEY = "otv_tasks";
const POLL_MS   = 30_000;

export interface UseTasksReturn {
  tasks: Task[];
  isLoading: boolean;
  syncError: string | null;
  /** API-syncing setter — new items are POST-ed; changed items are PATCH-ed. */
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  createTask: (payload: TaskCreate) => Promise<Task>;
  patchTask: (id: string, patch: TaskPatch) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  refetch: () => void;
}

export function useTasks(loggedIn = true): UseTasksReturn {
  const backendIds     = useRef<Set<string>>(new Set());
  const hadValidSess   = useRef(false);

  // Seed from localStorage for instant first-paint
  const [tasks, rawSetTasks] = useState<Task[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchAll = useCallback(async (isInitial?: boolean) => {
    try {
      const data = await tasksSvc.listTasks();
      hadValidSess.current = true;
      rawSetTasks(data);
      backendIds.current = new Set(data.map(t => t.id));
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch {}
      setSyncError(null);
    } catch (err: any) {
      if (err?.status === 401 || err?.httpStatus === 401) {
        if (hadValidSess.current) {
          window.dispatchEvent(new CustomEvent("otv:unauthorized"));
        }
      }
      /* offline / other errors — keep current state */
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => { fetchAll(true); }, [fetchAll]);

  useEffect(() => {
    if (!loggedIn) { setIsLoading(false); return; }
    fetchAll(true);
    const t = setInterval(() => fetchAll(false), POLL_MS);
    return () => clearInterval(t);
  }, [loggedIn, fetchAll]);

  /**
   * API-syncing setter — mirrors useApiEntityState write semantics.
   * New items → POST; changed items → PATCH. Local state updates immediately (optimistic).
   */
  const setTasks: React.Dispatch<React.SetStateAction<Task[]>> = useCallback((action) => {
    rawSetTasks(prev => {
      const next = typeof action === "function"
        ? (action as (p: Task[]) => Task[])(prev)
        : action;
      (async () => {
        try {
          for (const item of next) {
            if (!backendIds.current.has(item.id)) {
              await tasksSvc.createTask(item);
              backendIds.current.add(item.id);
            } else {
              const old = prev.find(t => t.id === item.id);
              if (old && JSON.stringify(old) !== JSON.stringify(item)) {
                await tasksSvc.patchTask(item.id, item);
              }
            }
          }
          try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch {}
          setSyncError(null);
        } catch { setSyncError("Sync failed — changes may not be saved."); }
      })();
      return next;
    });
  }, []);

  const createTask = useCallback(async (payload: TaskCreate): Promise<Task> => {
    const tempId = payload.id ?? `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = { ...payload, id: tempId } as Task;
    rawSetTasks(prev => [...prev, optimistic]);
    try {
      const created = await tasksSvc.createTask(payload);
      backendIds.current.add(created.id);
      rawSetTasks(prev => prev.map(t => t.id === tempId ? created : t));
      return created;
    } catch (err) {
      rawSetTasks(prev => prev.filter(t => t.id !== tempId));
      throw err;
    }
  }, []);

  const patchTask = useCallback(async (id: string, patch: TaskPatch): Promise<void> => {
    rawSetTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    try {
      await tasksSvc.patchTask(id, patch);
    } catch (err) {
      refetch();
      throw err;
    }
  }, [refetch]);

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    rawSetTasks(prev => prev.filter(t => t.id !== id));
    try {
      await tasksSvc.deleteTask(id);
      backendIds.current.delete(id);
    } catch (err) {
      refetch();
      throw err;
    }
  }, [refetch]);

  return { tasks, isLoading, syncError, setTasks, createTask, patchTask, deleteTask, refetch };
}
