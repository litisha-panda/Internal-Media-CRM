import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, ApiError } from "../services/api/_client";

/**
 * useApiEntityState — API is the single source of truth.
 * Fetches on mount and polls every 30s for multi-user consistency.
 * Writes are immediate: POST for new items, PATCH for changed items (optimistic update).
 * localStorage used only as a stale-while-revalidate cold cache (never as a sync layer).
 * Returns [data, setter, loading, syncError].
 */
export function useApiEntityState<T extends { id: string }>(
  apiPath: string,
  localKey: string,
  initial: T[],
): [T[], React.Dispatch<React.SetStateAction<T[]>>, boolean, string|null] {
  const backendIds = useRef<Set<string>>(new Set());
  const hadValidSession = useRef(false);

  const [state, setState] = useState<T[]>(() => {
    try {
      const cached = localStorage.getItem(localKey);
      return cached ? JSON.parse(cached) : initial;
    } catch { return initial; }
  });
  const [loading,   setLoading]   = useState(true);
  const [syncError, setSyncError] = useState<string|null>(null);

  const fetchAll = useCallback(async (isInitial?: boolean) => {
    try {
      const json = await apiFetch<{ ok: boolean; data: T[] }>(apiPath);
      if (json?.ok && Array.isArray(json.data)) {
        hadValidSession.current = true;
        setState(json.data);
        backendIds.current = new Set(json.data.map((i: T) => i.id));
        try { localStorage.setItem(localKey, JSON.stringify(json.data)); } catch {}
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        if (hadValidSession.current) {
          window.dispatchEvent(new CustomEvent("otv:unauthorized"));
        }
      }
    }
    finally { if (isInitial) setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, localKey]);

  useEffect(() => {
    fetchAll(true);
    const t = setInterval(() => fetchAll(false), 30_000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const setStateAndSync = useCallback((action: React.SetStateAction<T[]>) => {
    setState(prev => {
      const next = typeof action === "function" ? (action as (p: T[]) => T[])(prev) : action;
      (async () => {
        try {
          for (const item of next) {
            if (!backendIds.current.has(item.id)) {
              await apiFetch(apiPath, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item),
              });
              backendIds.current.add(item.id);
            } else {
              const old = prev.find(i => i.id === item.id);
              if (old && JSON.stringify(old) !== JSON.stringify(item)) {
                await apiFetch(`${apiPath}/${item.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(item),
                });
              }
            }
          }
          try { localStorage.setItem(localKey, JSON.stringify(next)); } catch {}
          setSyncError(null);
        } catch { setSyncError("Sync failed — changes may not be saved."); }
      })();
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, localKey]);

  return [state, setStateAndSync as React.Dispatch<React.SetStateAction<T[]>>, loading, syncError];
}
