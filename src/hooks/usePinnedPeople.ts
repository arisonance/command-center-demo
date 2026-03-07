'use client';

import { useState, useEffect, useCallback } from 'react';

interface PinnedPerson {
  person_name: string;
  person_email: string | null;
  pinned_at: string;
}

export function usePinnedPeople() {
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchPinned = useCallback(async () => {
    try {
      const res = await fetch('/api/data/pinned-people');
      if (!res.ok) return;
      const data = await res.json();
      const names = new Set<string>(
        (data.pinned || []).map((p: PinnedPerson) => p.person_name.toLowerCase().trim())
      );
      setPinned(names);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPinned();
  }, [fetchPinned]);

  const togglePin = useCallback(async (personName: string, personEmail?: string) => {
    const key = personName.toLowerCase().trim();
    const isPinned = pinned.has(key);

    // Optimistic update
    setPinned((prev) => {
      const next = new Set(prev);
      if (isPinned) next.delete(key); else next.add(key);
      return next;
    });

    try {
      if (isPinned) {
        await fetch('/api/data/pinned-people', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person_name: personName }),
        });
      } else {
        await fetch('/api/data/pinned-people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person_name: personName, person_email: personEmail }),
        });
      }
    } catch {
      // Revert on error
      setPinned((prev) => {
        const next = new Set(prev);
        if (isPinned) next.add(key); else next.delete(key);
        return next;
      });
    }
  }, [pinned]);

  const isPinned = useCallback((personName: string) => {
    return pinned.has(personName.toLowerCase().trim());
  }, [pinned]);

  return { pinned, isPinned, togglePin, loading };
}
