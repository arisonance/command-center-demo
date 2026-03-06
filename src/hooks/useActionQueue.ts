'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ActionQueueItem } from '@/lib/types';

export function useActionQueue() {
  const [actions, setActions] = useState<ActionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchActions = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('action_queue')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setActions(data as ActionQueueItem[]);
    }
    setLoading(false);
  }, [supabase]);

  const insertAction = useCallback(
    async (actionType: string, payload: Record<string, unknown>) => {
      const { data, error: insertError } = await supabase
        .from('action_queue')
        .insert({ action_type: actionType, payload, status: 'pending' })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }
      return data as ActionQueueItem;
    },
    [supabase]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch is async, setState is post-await
    fetchActions();

    const channel = supabase
      .channel('action-queue-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'action_queue' },
        (payload: { new: unknown }) => {
          setActions((prev) => [payload.new as ActionQueueItem, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'action_queue' },
        (payload: { new: unknown }) => {
          setActions((prev) =>
            prev.map((a) =>
              a.id === (payload.new as ActionQueueItem).id
                ? (payload.new as ActionQueueItem)
                : a
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'action_queue' },
        (payload: { old: unknown }) => {
          setActions((prev) =>
            prev.filter((a) => a.id !== (payload.old as ActionQueueItem).id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActions, supabase]);

  return { actions, loading, error, insertAction };
}
