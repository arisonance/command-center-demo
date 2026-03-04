'use client';

import { useLiveData } from '@/lib/live-data-context';
import type { SlackFeedMessage } from '@/lib/types';

export function useSlackFeed() {
  const { slack, loading, error, fetchedAt } = useLiveData();
  return {
    messages: slack as SlackFeedMessage[],
    loading,
    error,
    lastSynced: fetchedAt?.toISOString() ?? null,
    refetch: () => Promise.resolve(),
  };
}
