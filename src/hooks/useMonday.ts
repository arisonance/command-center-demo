'use client';
import { useState, useEffect, useCallback } from 'react';

interface MondayOrder {
  id: string;
  name: string;
  status: string;
  location: string;
  dealer: string;
  sales_order: string;
  amount: number;
  due_date: string;
  model: string;
  color: string;
  group_title: string;
  monday_url: string;
}

interface ThroughputItem {
  id: string;
  name: string;
  station: string;
  date: string;
  value: number;
  cycle_time: number;
}

interface MondayData {
  orders: MondayOrder[];
  throughput: ThroughputItem[];
  connected: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMonday(skip = false): MondayData {
  const [orders, setOrders] = useState<MondayOrder[]>([]);
  const [throughput, setThroughput] = useState<ThroughputItem[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data/monday');
      if (!res.ok) throw new Error(`Monday fetch failed: ${res.status}`);
      const data = await res.json();
      setConnected(data.connected !== false);
      setOrders(data.orders ?? []);
      setThroughput(data.throughput ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!skip) fetchData();
  }, [fetchData, skip]);

  return { orders, throughput, connected, loading, error, refetch: fetchData };
}
