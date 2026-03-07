'use client';

import { useLiveData } from '@/lib/live-data-context';

export function useEmails() {
  const { emails, sentEmails, loading, error, fetchedAt } = useLiveData();
  return {
    emails,
    sentEmails,
    loading,
    error,
    lastSynced: fetchedAt?.toISOString() ?? null,
  };
}
