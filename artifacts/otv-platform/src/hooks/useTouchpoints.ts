/**
 * useTouchpoints — Fetch and mutate touchpoints via the touchpoints service.
 *
 * The exported `setTouchpoints` setter is API-syncing: new items are POST-ed,
 * changed items are PATCH-ed — matching the semantics of the previous
 * useApiEntityState hook so all existing call sites continue to persist.
 *
 * Typed mutation helpers (createTouchpoint, patchTouchpoint) provide
 * optimistic updates with server-confirmed reconciliation and error rollback.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as tpSvc from "../services/api/touchpoints";
import type { Touchpoint, TouchpointCreate, TouchpointPatch } from "../services/api/touchpoints";

export interface UseTouchpointsReturn {
  touchpoints: Touchpoint[];
  isLoading: boolean;
  /** API-syncing setter — new items are POST-ed; changed items are PATCH-ed. */
  setTouchpoints: React.Dispatch<React.SetStateAction<Touchpoint[]>>;
  createTouchpoint: (payload: TouchpointCreate) => Promise<Touchpoint>;
  patchTouchpoint: (id: string, patch: Partial<TouchpointPatch>) => Promise<void>;
  refetch: () => void;
}

export function useTouchpoints(loggedIn: boolean): UseTouchpointsReturn {
  const [touchpoints, rawSetTouchpoints] = useState<Touchpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tracks IDs confirmed in the backend
  const backendIds = useRef<Set<string>>(new Set());

  const refetch = useCallback(() => {
    setIsLoading(true);
    tpSvc.listTouchpoints()
      .then(data => {
        rawSetTouchpoints(data);
        backendIds.current = new Set(data.map(tp => tp.id));
      })
      .catch(() => {})
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
        } catch {
          // Offline / error — local state still reflects the optimistic update
        }
      })();
      return next;
    });
  }, []);

  const createTouchpoint = useCallback(async (payload: TouchpointCreate): Promise<Touchpoint> => {
    // Optimistic append
    const tempId = payload.id ?? `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = { ...payload, id: tempId } as Touchpoint;
    rawSetTouchpoints(prev => [...prev, optimistic]);
    try {
      const created = await tpSvc.createTouchpoint(payload);
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

  return { touchpoints, isLoading, setTouchpoints, createTouchpoint, patchTouchpoint, refetch };
}
