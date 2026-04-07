/**
 * useTasks — Fetch and mutate tasks via the tasks service.
 *
 * Fetches on mount (when `loggedIn` becomes true). Exposes the list,
 * isLoading flag, and typed mutation helpers (createTask, patchTask,
 * deleteTask). Optimistic updates applied immediately; reverts on error.
 */

import { useState, useEffect, useCallback } from "react";
import * as tasksSvc from "../services/api/tasks";
import type { Task, TaskCreate, TaskPatch } from "../services/api/tasks";

export interface UseTasksReturn {
  tasks: Task[];
  isLoading: boolean;
  syncError: string | null;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  createTask: (payload: TaskCreate) => Promise<Task>;
  patchTask: (id: string, patch: TaskPatch) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  refetch: () => void;
}

export function useTasks(loggedIn: boolean): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setIsLoading(true);
    tasksSvc.listTasks()
      .then(data => { setTasks(data); setSyncError(null); })
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

  const createTask = useCallback(async (payload: TaskCreate): Promise<Task> => {
    // Optimistic append (prepend — tasks are shown newest-first)
    const tempId = payload.id ?? `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = { ...payload, id: tempId } as Task;
    setTasks(prev => [optimistic, ...prev]);
    try {
      const created = await tasksSvc.createTask(payload);
      setTasks(prev => prev.map(t => t.id === tempId ? created : t));
      return created;
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== tempId));
      throw err;
    }
  }, []);

  const patchTask = useCallback(async (id: string, patch: TaskPatch): Promise<void> => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    try {
      await tasksSvc.patchTask(id, patch);
    } catch (err) {
      refetch();
      throw err;
    }
  }, [refetch]);

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    const snapshot = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await tasksSvc.deleteTask(id);
    } catch (err) {
      setTasks(snapshot);
      throw err;
    }
  }, [tasks]);

  return { tasks, isLoading, syncError, setTasks, createTask, patchTask, deleteTask, refetch };
}
