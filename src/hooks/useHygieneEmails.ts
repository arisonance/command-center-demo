'use client';
import { useState, useEffect, useCallback } from 'react';

export interface HygieneEmail {
  id: string;
  subject: string;
  from_name: string;
  from_email: string;
  received_at: string;
  is_read: boolean;
  preview: string;
  outlook_url: string;
  internet_message_id: string;
}

export function useHygieneEmails() {
  const [emails, setEmails] = useState<HygieneEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data/hygiene-emails');
      const data = await res.json();
      setEmails(data.emails || []);
      if (data.error) setError(data.error);
      else setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const removeEmail = useCallback((id: string) => {
    setEmails(prev => prev.filter(e => e.id !== id));
  }, []);

  return { emails, loading, error, refetch: fetchEmails, removeEmail };
}
