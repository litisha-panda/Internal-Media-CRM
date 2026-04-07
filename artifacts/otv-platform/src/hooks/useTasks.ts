/**
 * useTasks — Fetch and mutate tasks via the tasks service.
 *
 * The exported `setTasks` setter is API-syncing: new items are POST-ed,
 * changed items are PATCH-ed — matching the semantics of the previous
 * useApiEntityState hook so all existing call sites continue to persist.
 *
 * Typed mutation helpers (createTask, patchTask, deleteTask) provide
 * optimistic updates with server-confirmed reconciliation and error rollback.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as tasksSvc from "../services/api/tasks";
import type { Task, TaskCreate, TaskPatch } from "../services/api/tasks";

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

export function useTasks(loggedIn: boolean): UseTasksReturn {
  const [tasks, rawSetTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Tracks IDs that are confirmed in the backend
  const backendIds = useRef<Set<string>>(new Set());

  const refetch = useCallback(() => {
    setIsLoading(true);
    tasksSvc.listTasks()
      .then(data => {
        rawSetTasks(data);
        backendIds.current = new Set(data.map(t => t.id));
        setSyncError(null);
      })
      .catch(() => setSyncError("Failed to load tasks"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      setIsLoading(false);
      return;
    }
    refetch();
  }, [loggedIn, refetch]);

  /**
   * API-syncing setter — mirrors useApiEntityState write semantics.
   * New items → POST; changed items → PATCH. Local state updates immediately (optimistic).
   */
  const setTasks: React.Dispatch<React.SetStateAction<Task[]>> = useCallback((action) => {
    rawSetTasks(prev => {
      const next = typeof action === "function" ? (action as (p: Task[]) => Task[])(prev) : action;
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
          setSyncError(null);
        } catch {
          setSyncError("Sync failed — changes may not be saved.");
        }
      })();
      return next;
    });
  }, []);

  const createTask = useCallback(async (payload: TaskCreate): Promise<Task> => {
    // Optimistic prepend — tasks shown newest-first
    const tempId = payload.id ?? `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = { ...payload, id: tempId } as Task;
    rawSetTasks(prev => [optimistic, ...prev]);
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
    const snapshot = tasks;
    rawSetTasks(prev => prev.filter(t => t.id !== id));
    backendIds.current.delete(id);
    try {
      await tasksSvc.deleteTask(id);
    } catch (err) {
      rawSetTasks(snapshot);
      backendIds.current.add(id);
      throw err;
    }
  }, [tasks]);

  return { tasks, isLoading, syncError, setTasks, createTask, patchTask, deleteTask, refetch };
}
