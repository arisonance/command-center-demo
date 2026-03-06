'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SyncLog } from '@/lib/types';

export function useSyncStatus() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchLogs = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setLogs(data as SyncLog[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch is async, setState is post-await
    fetchLogs();

    const channel = supabase
      .channel('sync-log-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sync_log' },
        (payload: { new: unknown }) => {
          setLogs((prev) => [payload.new as SyncLog, ...prev].slice(0, 10));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sync_log' },
        (payload: { new: unknown }) => {
          setLogs((prev) =>
            prev.map((l) =>
              l.id === (payload.new as SyncLog).id ? (payload.new as SyncLog) : l
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs, supabase]);

  return { logs, loading, error };
}
