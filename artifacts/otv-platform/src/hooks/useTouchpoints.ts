/**
 * useTouchpoints — Fetch and mutate touchpoints via the touchpoints service.
 *
 * Fetches on mount (when `loggedIn` becomes true). Exposes the list,
 * isLoading flag, createTouchpoint (optimistic append), patchTouchpoint
 * (optimistic update). Reverts on server error.
 */

import { useState, useEffect, useCallback } from "react";
import * as tpSvc from "../services/api/touchpoints";
import type { Touchpoint, TouchpointCreate, TouchpointPatch } from "../services/api/touchpoints";

export interface UseTouchpointsReturn {
  touchpoints: Touchpoint[];
  isLoading: boolean;
  setTouchpoints: React.Dispatch<React.SetStateAction<Touchpoint[]>>;
  createTouchpoint: (payload: TouchpointCreate) => Promise<Touchpoint>;
  patchTouchpoint: (id: string, patch: Partial<TouchpointPatch>) => Promise<void>;
  refetch: () => void;
}

export function useTouchpoints(loggedIn: boolean): UseTouchpointsReturn {
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(() => {
    setIsLoading(true);
    tpSvc.listTouchpoints()
      .then(data => setTouchpoints(data))
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

  const createTouchpoint = useCallback(async (payload: TouchpointCreate): Promise<Touchpoint> => {
    const created = await tpSvc.createTouchpoint(payload);
    setTouchpoints(prev => [...prev, created]);
    return created;
  }, []);

  const patchTouchpoint = useCallback(
    async (id: string, patch: Partial<TouchpointPatch>): Promise<void> => {
      // Optimistic update
      setTouchpoints(prev => prev.map(tp => tp.id === id ? { ...tp, ...patch } : tp));
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
