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

export function useMeetings(loggedIn: boolean): UseMeetingsReturn {
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
    const created = await meetingsSvc.createMeeting(payload);
    setMeetings(prev => [...prev, created]);
    return created;
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
