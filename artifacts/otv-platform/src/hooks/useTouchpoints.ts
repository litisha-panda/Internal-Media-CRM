/**
 * useTouchpoints — Fetch and mutate touchpoints via the touchpoints service.
 *
 * Behaviorally identical to useApiEntityState (touchpoints domain):
 *   - localStorage seed for instant first-paint (stale-while-revalidate)
 *   - Fetches on mount; polls every 30s for multi-user consistency
 *   - 401 after a valid session fires window "otv:unauthorized" event
 *   - API-syncing setter: new items POST-ed, changed items PATCH-ed
 *   - Optimistic typed helpers: createTouchpoint, patchTouchpoint
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as tpSvc from "../services/api/touchpoints";
import type { Touchpoint, TouchpointCreate, TouchpointPatch } from "../services/api/touchpoints";

const LOCAL_KEY = "otv_touchpoints";
const POLL_MS   = 30_000;

/** Narrow an unknown catch value to an HTTP status code, or -1 if not available. */
function httpStatus(err: unknown): number {
  if (err !== null && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const s = e["status"] ?? e["httpStatus"];
    if (typeof s === "number") return s;
  }
  return -1;
}

export interface UseTouchpointsReturn {
  touchpoints: Touchpoint[];
  isLoading: boolean;
  syncError: string | null;
  /** API-syncing setter — new items are POST-ed; changed items are PATCH-ed. */
  setTouchpoints: React.Dispatch<React.SetStateAction<Touchpoint[]>>;
  createTouchpoint: (payload: TouchpointCreate) => Promise<Touchpoint>;
  patchTouchpoint: (id: string, patch: Partial<TouchpointPatch>) => Promise<void>;
  refetch: () => void;
}

export function useTouchpoints(loggedIn = true): UseTouchpointsReturn {
  const backendIds   = useRef<Set<string>>(new Set());
  const hadValidSess = useRef(false);

  // Seed from localStorage for instant first-paint
  const [touchpoints, rawSetTouchpoints] = useState<Touchpoint[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchAll = useCallback(async (isInitial?: boolean) => {
    try {
      const data = await tpSvc.listTouchpoints();
      hadValidSess.current = true;
      rawSetTouchpoints(data);
      backendIds.current = new Set(data.map(tp => tp.id));
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch {}
      setSyncError(null);
    } catch (err: unknown) {
      if (httpStatus(err) === 401 && hadValidSess.current) {
        window.dispatchEvent(new CustomEvent("otv:unauthorized"));
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
  const setTouchpoints: React.Dispatch<React.SetStateAction<Touchpoint[]>> = useCallback((action) => {
    rawSetTouchpoints(prev => {
      const next = typeof action === "function"
        ? (action as (p: Touchpoint[]) => Touchpoint[])(prev)
        : action;
      (async () => {
        try {
          for (const item of next) {
            if (!backendIds.current.has(item.id)) {
              await tpSvc.createTouchpoint(item);
              backendIds.current.add(item.id);
            } else {
              const old = prev.find(tp => tp.id === item.id);
              if (old && JSON.stringify(old) !== JSON.stringify(item)) {
                await tpSvc.patchTouchpoint(item.id, item);
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

  const createTouchpoint = useCallback(async (payload: TouchpointCreate): Promise<Touchpoint> => {
    const tempId = payload.id ?? `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = { ...payload, id: tempId } as Touchpoint;
    rawSetTouchpoints(prev => [...prev, optimistic]);
    try {
      const created = await tpSvc.createTouchpoint({ ...payload, id: tempId });
      backendIds.current.add(created.id);
      rawSetTouchpoints(prev => prev.map(tp => tp.id === tempId ? created : tp));
      return created;
    } catch (err) {
      rawSetTouchpoints(prev => prev.filter(tp => tp.id !== tempId));
      throw err;
    }
  }, []);

  const patchTouchpoint = useCallback(
    async (id: string, patch: Partial<TouchpointPatch>): Promise<void> => {
      rawSetTouchpoints(prev => prev.map(tp => tp.id === id ? { ...tp, ...patch } : tp));
      try {
        await tpSvc.patchTouchpoint(id, patch);
      } catch (err) {
        refetch();
        throw err;
      }
    },
    [refetch],
  );

  return { touchpoints, isLoading, syncError, setTouchpoints, createTouchpoint, patchTouchpoint, refetch };
}
