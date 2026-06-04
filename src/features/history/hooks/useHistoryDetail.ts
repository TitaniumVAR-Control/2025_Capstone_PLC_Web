import { useEffect, useState } from 'react';
import type { VarProcessData } from '../../monitoring/types';
import type { ReportAutoData } from '../../report/types';
import type { ReportMeta } from './useHistoryList';

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT ?? '8000';
const API_BASE = `http://${window.location.hostname}:${BACKEND_PORT}`;

export interface ReportPayload {
  meta: ReportMeta;
  auto: ReportAutoData;
  timeseries: VarProcessData[];
}

export function useHistoryDetail(reportId: string | null) {
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/var-reports/${encodeURIComponent(reportId)}`);
        if (!res.ok) throw new Error(`status=${res.status}`);
        const data = await res.json();
        if (!cancelled) setPayload(data as ReportPayload);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportId]);

  return { payload, loading, error };
}
