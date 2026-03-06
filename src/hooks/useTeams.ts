'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TeamsChannel } from '@/lib/types';

export function useTeams() {
  const [channels, setChannels] = useState<TeamsChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchChannels = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('teams_channels')
      .select('*')
      .order('team_name', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setChannels(data as TeamsChannel[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch is async, setState is post-await
    fetchChannels();

    const channel = supabase
      .channel('teams-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'teams_channels' },
        (payload: { new: unknown }) => {
          setChannels((prev) => [...prev, payload.new as TeamsChannel]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'teams_channels' },
        (payload: { new: unknown }) => {
          setChannels((prev) =>
            prev.map((c) =>
              c.id === (payload.new as TeamsChannel).id ? (payload.new as TeamsChannel) : c
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'teams_channels' },
        (payload: { old: unknown }) => {
          setChannels((prev) =>
            prev.filter((c) => c.id !== (payload.old as TeamsChannel).id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchChannels, supabase]);

  return { channels, loading, error };
}
