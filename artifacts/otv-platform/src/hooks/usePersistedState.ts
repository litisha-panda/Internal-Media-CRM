import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../services/api/_client";

/**
 * usePersistedState — localStorage-backed state that also syncs to the server
 * at /api/state/:key.  Polls every 20s for cross-user consistency.
 * localStorage is used for instant initial paint; the server is the source of truth.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePersistedState<T = any>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : initial;
    } catch { return initial; }
  });

  const lastWriteRef    = useRef<number>(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const isFirstRunRef   = useRef(true);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
    if (!isFirstRunRef.current) {
      lastWriteRef.current = Date.now();
    }
    isFirstRunRef.current = false;
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(async () => {
      try {
        await apiFetch(`/api/state/${key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: state }),
        });
      } catch { /* offline — localStorage still has it */ }
    }, 1000);
    return () => { if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); };
  }, [key, state]);

  useEffect(() => {
    const load = async (isPoll = false) => {
      try {
        const data = await apiFetch(`/api/state/${key}`).catch(() => null);
        if (!data) return;
        if ((data as Record<string,unknown>).ok && (data as Record<string,unknown>).value !== null) {
          const serverTs = (data as Record<string,unknown>).updatedAt
            ? new Date((data as Record<string,unknown>).updatedAt as string).getTime()
            : 0;
          if (lastWriteRef.current > serverTs - 5000) return;
          setState((data as Record<string,unknown>).value as T);
          try { localStorage.setItem(key, JSON.stringify((data as Record<string,unknown>).value)); } catch {}
        } else if (!isPoll) {
          apiFetch(`/api/state/${key}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: state }),
          }).catch(() => {});
        }
      } catch { /* offline */ }
    };

    load(false);
    const interval = setInterval(() => load(true), 20000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try { setState(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [state, setState];
}
