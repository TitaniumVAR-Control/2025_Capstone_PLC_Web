import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiagAck, DiagConnection, DiagDefaults, DiagRg1, LogEntry, LogLevel } from '../types';

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT ?? '8000';
const BACKEND_HTTP = `http://${window.location.hostname}:${BACKEND_PORT}`;

const RG1_POLL_INTERVAL_MS = 1000;
const MAX_LOG_ENTRIES = 100;

function nowHms(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_HTTP}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const detail = (parsed && typeof parsed === 'object' && 'detail' in parsed)
      ? String((parsed as { detail: unknown }).detail)
      : (typeof parsed === 'string' ? parsed : `HTTP ${res.status}`);
    throw new Error(`${res.status}: ${detail}`);
  }
  return parsed as T;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_HTTP}${path}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function usePlcDiag() {
  const [connection, setConnection] = useState<DiagConnection>({ connected: false, host: '', port: 0 });
  const [defaults, setDefaults] = useState<DiagDefaults | null>(null);
  const [rg1, setRg1] = useState<DiagRg1 | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const pollTimer = useRef<number | null>(null);

  const addLog = useCallback((level: LogLevel, label: string, message: string) => {
    setLogs(prev => [{ ts: nowHms(), level, label, message }, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, []);

  const refreshConnection = useCallback(async () => {
    try {
      const c = await getJson<DiagConnection>('/api/plc/diag/connection');
      setConnection(c);
      return c;
    } catch (exc) {
      addLog('error', 'connection', String(exc));
      return null;
    }
  }, [addLog]);

  const loadDefaults = useCallback(async () => {
    try {
      const d = await getJson<DiagDefaults>('/api/plc/diag/defaults');
      setDefaults(d);
    } catch (exc) {
      addLog('error', 'defaults', String(exc));
    }
  }, [addLog]);

  const pollRg1 = useCallback(async () => {
    try {
      const r = await getJson<DiagRg1>('/api/plc/diag/rg1');
      setRg1(r);
    } catch {
      // 폴링 실패는 로그 스팸 방지 — 그냥 무시
    }
  }, []);

  const refreshRg1 = useCallback(async () => {
    setBusy(true);
    try {
      const r = await postJson<DiagRg1>('/api/plc/diag/rg1/refresh');
      setRg1(r);
      addLog(r.ok ? 'ok' : 'error', 'G1', r.ok ? `RG1 수신 (${r.elapsed_ms}ms)` : (r.error ?? '실패'));
    } catch (exc) {
      addLog('error', 'G1', String(exc));
    } finally {
      setBusy(false);
    }
  }, [addLog]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const c = await postJson<DiagConnection>('/api/plc/diag/connect');
      setConnection(c);
      if (c.connected) {
        addLog('ok', 'connect', `${c.host}:${c.port} 접속 성공`);
      } else {
        addLog('error', 'connect', c.error ?? '접속 실패');
      }
    } catch (exc) {
      addLog('error', 'connect', String(exc));
    } finally {
      setBusy(false);
    }
  }, [addLog]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      const c = await postJson<DiagConnection>('/api/plc/diag/disconnect');
      setConnection(c);
      addLog('info', 'disconnect', '연결 해제');
    } catch (exc) {
      addLog('error', 'disconnect', String(exc));
    } finally {
      setBusy(false);
    }
  }, [addLog]);

  const sendCommand = useCallback(async (
    path: string,
    label: string,
    body: Record<string, unknown>,
  ): Promise<DiagAck | null> => {
    setBusy(true);
    try {
      const ack = await postJson<DiagAck>(path, body);
      const level: LogLevel = ack.ok ? 'ok' : 'error';
      const summary = ack.ok
        ? `${ack.rs_code ?? 'OK'} (${ack.elapsed_ms}ms)`
        : (ack.error ?? '실패');
      addLog(level, label, summary);
      return ack;
    } catch (exc) {
      addLog('error', label, String(exc));
      return null;
    } finally {
      setBusy(false);
    }
  }, [addLog]);

  useEffect(() => {
    loadDefaults();
    refreshConnection();
  }, [loadDefaults, refreshConnection]);

  // RG1 폴링: 연결돼 있을 때만 1초 주기
  useEffect(() => {
    if (!connection.connected) {
      if (pollTimer.current != null) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    pollRg1();
    pollTimer.current = window.setInterval(pollRg1, RG1_POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current != null) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [connection.connected, pollRg1]);

  return {
    connection,
    defaults,
    rg1,
    logs,
    busy,
    connect,
    disconnect,
    refreshRg1,
    sendCommand,
    refreshConnection,
  };
}
