/**
 * useMeetings — Fetch and mutate meetings via the meetings service.
 *
 * Fetches on mount (when `loggedIn` becomes true). Exposes the list,
 * isLoading flag, createMeeting (optimistic append), and patchMeeting
 * (optimistic update). Reverts on server error.
 */

import { useState, useEffect, useCallback } from "react";
import * as meetingsSvc from "../services/api/meetings";
import type { Meeting, MeetingCreate, MeetingPatch } from "../services/api/meetings";

export interface UseMeetingsReturn {
  meetings: Meeting[];
  isLoading: boolean;
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  createMeeting: (payload: MeetingCreate) => Promise<Meeting>;
  patchMeeting: (id: string, patch: MeetingPatch) => Promise<void>;
  refetch: () => void;
}

export function useMeetings(loggedIn = true): UseMeetingsReturn {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(() => {
    setIsLoading(true);
    meetingsSvc.listMeetings()
      .then(data => setMeetings(data))
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

  const createMeeting = useCallback(async (payload: MeetingCreate): Promise<Meeting> => {
    // Optimistic append — build a temporary item with the payload shape
    const tempId = payload.id ?? `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = { ...payload, id: tempId } as Meeting;
    setMeetings(prev => [...prev, optimistic]);
    try {
      const created = await meetingsSvc.createMeeting(payload);
      // Replace the optimistic item with the confirmed server record
      setMeetings(prev => prev.map(m => m.id === tempId ? created : m));
      return created;
    } catch (err) {
      // Revert optimistic item on error
      setMeetings(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  }, []);

  const patchMeeting = useCallback(async (id: string, patch: MeetingPatch): Promise<void> => {
    // Optimistic update
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
    try {
      await meetingsSvc.patchMeeting(id, patch);
    } catch (err) {
      // Revert on error — refetch from server
      refetch();
      throw err;
    }
  }, [refetch]);

  return { meetings, isLoading, setMeetings, createMeeting, patchMeeting, refetch };
}
