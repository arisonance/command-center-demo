'use client';

import { useLiveData } from '@/lib/live-data-context';
import type { AsanaCommentThread } from '@/lib/types';

export function useAsanaComments() {
  const { asanaComments, loading, error, fetchedAt } = useLiveData();

  return {
    comments: asanaComments as AsanaCommentThread[],
    loading,
    error,
    lastSynced: fetchedAt?.toISOString() ?? null,
  };
}
