import { useEffect, useState, useCallback } from 'react';

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT ?? '8000';
const API_BASE = `http://${window.location.hostname}:${BACKEND_PORT}`;

export interface ReportMeta {
  reportId: string;
  workId: string;
  selectedFile: string;
  startedAt: string;
  endedAt: string;
  endReason: string;
  totalRows: number;
  targetLengthMm: number;
  targetCurrent: number;
}

export function useHistoryList() {
  const [items, setItems] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/var-reports`);
      if (!res.ok) throw new Error(`status=${res.status}`);
      const data = await res.json();
      setItems((data.items ?? []) as ReportMeta[]);
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, loading, error, refresh };
}
