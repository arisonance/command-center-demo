'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PersonSummaryData {
  summary: string;
  openLoops: { type: string; label: string; url: string }[];
  sharedContext: {
    projects: string[];
    upcomingMeetings: { subject: string; date: string }[];
    totalEmails: number;
    totalMeetings: number;
    totalSlackMessages: number;
  };
  lastMeeting: { subject: string; date: string } | null;
  nextMeeting: { subject: string; date: string } | null;
}

export function usePersonSummary(personName: string | null, personEmail?: string) {
  const [data, setData] = useState<PersonSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, PersonSummaryData>>(new Map());

  const fetchSummary = useCallback(async (name: string, email?: string) => {
    const cacheKey = name.toLowerCase().trim();
    if (cache.current.has(cacheKey)) {
      setData(cache.current.get(cacheKey)!);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ name });
      if (email) params.set('email', email);
      const res = await fetch(`/api/data/person-summary?${params}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const result: PersonSummaryData = await res.json();
      cache.current.set(cacheKey, result);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (personName) {
      fetchSummary(personName, personEmail);
    } else {
      setData(null);
    }
  }, [personName, personEmail, fetchSummary]);

  return { data, loading, error };
}
