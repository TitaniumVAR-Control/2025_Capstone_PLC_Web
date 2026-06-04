import { useState, useEffect, useRef, useCallback } from 'react';
import type { VarProcessData, MonitoringState, EventLogEntry, CurrentProfiles } from '../types';

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT ?? '8000';
const WS_URL = `ws://${window.location.hostname}:${BACKEND_PORT}/ws/monitor`;

const EMPTY_META = {
  powerOn: false,
  simulationRunning: false,
  workId: '',
  selectedFile: '',
  startedAt: null as string | null,
  elapsedTime: 0,
  targetLengthMm: 0,
  previewData: null as VarProcessData | null,
  currentProfiles: null as CurrentProfiles | null,
  phaseEnteredAt: {} as Record<string, number>,
};

function toPoint(msg: Record<string, unknown>): VarProcessData {
  const rawProgress = msg.progress_pct == null ? null : Number(msg.progress_pct);
  return {
    timestamp: String(msg.timestamp ?? ''),
    current: Number(msg.current ?? 0),
    vacuum: Number(msg.vacuum ?? 0),
    voltage: Number(msg.voltage ?? 0),
    descentSpeed: Number(msg.descentSpeed ?? 0),
    elapsedTime: Number(msg.elapsedTime ?? 0),
    recommendedSpeed: msg.recommended_speed == null ? null : Number(msg.recommended_speed),
    predictedCurrent: msg.predicted_current == null ? null : Number(msg.predicted_current),
    targetLengthMm: msg.target_length_mm == null ? null : Number(msg.target_length_mm),
    cumulativeDescent: msg.cumulative_descent == null ? null : Number(msg.cumulative_descent),
    phase: msg.phase == null ? null : String(msg.phase),
    progressPct: rawProgress == null ? null : Math.min(100, rawProgress),
    processState: msg.process_state == null ? null : String(msg.process_state),
    voltageCommandRatio: msg.voltage_command_ratio == null ? null : Number(msg.voltage_command_ratio),
    meltLengthMm: msg.melt_length_mm == null ? null : Number(msg.melt_length_mm),
    remainingMeltMm: msg.remaining_melt_mm == null ? null : Number(msg.remaining_melt_mm),
    arcDetected: Boolean(msg.arc_detected ?? false),
    targetReached: Boolean(msg.target_reached ?? false),
    rpmPrimaryOn: Boolean(msg.rpm_primary_on ?? false),
    rpmSecondaryOn: Boolean(msg.rpm_secondary_on ?? false),
    tiltingOn: Boolean(msg.tilting_on ?? false),
    coolingOn: Boolean(msg.cooling_on ?? false),
    processEvent: msg.process_event == null ? null : String(msg.process_event),
    // 2026-05 외란 변수
    coolantTemp: msg.coolant_temp == null ? null : Number(msg.coolant_temp),
    flow: msg.flow == null ? null : Number(msg.flow),
    chamberTemp: msg.chamber_temp == null ? null : Number(msg.chamber_temp),
  };
}

const BACKEND_HTTP = `http://${window.location.hostname}:${BACKEND_PORT}`;

async function fetchCurrentProfiles() {
  try {
    const res = await fetch(`${BACKEND_HTTP}/api/current-profiles`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * WebSocket 기반 실시간 모니터링 데이터 훅
 */
export function useMonitoringData() {
  const [state, setState] = useState<MonitoringState>({ status: 'loading', data: [], meta: EMPTY_META });
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [completionNotice, setCompletionNotice] = useState<{ workId: string; finishedAt: string } | null>(null);
  const [frozenHistory, setFrozenHistory] = useState<VarProcessData[]>([]);
  const dataRef = useRef<VarProcessData[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const lastPhaseRef = useRef<string | null>(null);

  const addEvent = useCallback((message: string, type: EventLogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEvents(prev => [...prev.slice(-49), { time, message, type }]);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(prev => prev.status === 'error' ? { status: 'loading', data: prev.data, meta: prev.meta } : prev);
      addEvent('서버 연결됨', 'success');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>;

        if (msg.type === 'system_state') {
          const currentIndexValue = Number(msg.current_index ?? 0);
          const isPowerOn = Boolean(msg.power_on ?? false);
          const isRunning = Boolean(msg.simulation_running ?? false);
          const previewData = msg.preview_point ? toPoint(msg.preview_point as Record<string, unknown>) : null;

          // backfill 로 채워진 상태에서 system_state 가 와도 초기화하지 않도록 가드.
          // - 전원 OFF: 무조건 초기화 (사용자 의도)
          // - 시뮬 시작(currentIndex=0) 이면서 dataRef 가 비어있을 때만 초기화
          const shouldReset = !isPowerOn ||
            (isRunning && currentIndexValue === 0 && dataRef.current.length === 0);
          if (shouldReset) {
            dataRef.current = [];
            lastPhaseRef.current = null;
            if (isRunning && currentIndexValue === 0) {
              setCompletionNotice(null);
            }
          }
          setState(prev => ({
            status: 'success',
            data: [...dataRef.current],
            meta: {
              powerOn: isPowerOn,
              simulationRunning: isRunning,
              workId: String(msg.work_id ?? ''),
              selectedFile: String(msg.selected_file ?? ''),
              startedAt: msg.started_at == null ? null : String(msg.started_at),
              elapsedTime: Number(msg.elapsed_time ?? 0),
              targetLengthMm: Number(msg.target_length_mm ?? 0),
              previewData,
              currentProfiles: prev.meta.currentProfiles ?? null,
              phaseEnteredAt: isRunning && currentIndexValue === 0 ? {} : prev.meta.phaseEnteredAt ?? {},
            },
          }));
          return;
        }

        if (msg.type === 'finished') {
          const finishedAt = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const workId = String(msg.work_id ?? state.meta.workId ?? '');
          setCompletionNotice({ workId, finishedAt });
          setFrozenHistory([...dataRef.current]);
          addEvent(`작업 종료: ${workId || 'simulation'}`, 'success');
          setState(prev => ({
            status: 'success',
            data: prev.data,
            meta: {
              ...prev.meta,
              simulationRunning: false,
            },
          }));
          return;
        }

        if (msg.type === 'plc_command') {
          // 매퍼가 발행한 S 명령 (sim: 가상 / hmi: 실제 송신). 평가용 로그.
          const mode = String(msg.mode ?? 'sim').toUpperCase();
          const state = String(msg.process_state ?? '?');
          const desc = String(msg.description ?? msg.command ?? '?');
          const ok = Boolean(msg.ok ?? true);
          const prefix = `[${mode}] [${state}] ${desc}`;
          if (!ok) {
            addEvent(`${prefix} — 실패: ${String(msg.error ?? '?')}`, 'error');
          } else {
            addEvent(prefix, 'info');
          }
          return;
        }

        if (msg.type !== 'sensor') return;

        const point = toPoint(msg);
        // 백필로 받은 tick 과 WS 첫 tick 이 겹칠 수 있어 elapsedTime 단조성 가드
        const last = dataRef.current[dataRef.current.length - 1];
        if (last && point.elapsedTime <= last.elapsedTime) {
          return;
        }
        dataRef.current = [...dataRef.current, point];

        // Phase change event detection
        const newPhaseEnter: Record<string, number> | null =
          point.phase && point.phase !== lastPhaseRef.current ? { [point.phase]: point.elapsedTime } : null;
        if (point.phase && point.phase !== lastPhaseRef.current) {
          const phaseNames: Record<string, string> = {
            'DESCENT_INIT': '아크 전 하강 시작',
            'APPROACH': '칩/바켓 용융 구간 진입',
            'STABLE_MELT': '안정 용융 구간 진입',
          };
          addEvent(phaseNames[point.phase] ?? `구간 변경: ${point.phase}`, point.phase === 'STABLE_MELT' ? 'success' : 'info');
          lastPhaseRef.current = point.phase;
        }

        setState(prev => ({
          status: 'success',
          data: [...dataRef.current],
          meta: {
            ...prev.meta,
            powerOn: true,
            simulationRunning: true,
            elapsedTime: point.elapsedTime,
            targetLengthMm: Number(msg.target_length_mm ?? prev.meta.targetLengthMm),
            previewData: point,
            phaseEnteredAt: newPhaseEnter
              ? { ...(prev.meta.phaseEnteredAt ?? {}), ...newPhaseEnter }
              : (prev.meta.phaseEnteredAt ?? {}),
          },
        }));
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      if (!reconnectTimer.current) {
        reconnectTimer.current = window.setTimeout(() => {
          reconnectTimer.current = null;
          connect();
        }, 2000);
      }
    };

    ws.onerror = () => {
      setState(prev => ({
        status: 'error',
        message: '백엔드 서버에 연결할 수 없습니다.',
        data: prev.data,
        meta: prev.meta,
      }));
      addEvent('서버 연결 끊김', 'error');
    };
  }, [addEvent]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) 진행 중 작업이 있으면 그 동안의 tick 들을 받아 그래프 복원
      try {
        const activeRes = await fetch(`${BACKEND_HTTP}/api/session/active`);
        if (cancelled || !activeRes.ok) return;
        const active = await activeRes.json();
        if (!active?.active || !active.work_id) return;

        const replayRes = await fetch(
          `${BACKEND_HTTP}/api/session/${encodeURIComponent(String(active.work_id))}/replay`,
        );
        if (cancelled || !replayRes.ok) return;
        const replay = await replayRes.json();
        const ticks: VarProcessData[] = (replay.ticks ?? []).map(
          (t: Record<string, unknown>) => toPoint(t),
        );
        if (ticks.length === 0) return;

        dataRef.current = ticks;
        const last = ticks[ticks.length - 1];
        setState(prev => ({
          status: 'success',
          data: [...dataRef.current],
          meta: {
            ...prev.meta,
            powerOn: true,
            simulationRunning: Boolean(active.simulation_running),
            workId: String(active.work_id),
            selectedFile: String(active.selected_file ?? ''),
            startedAt: active.started_at ?? null,
            elapsedTime: Number(active.elapsed_time ?? last.elapsedTime),
            targetLengthMm: Number(active.target_length_mm ?? 0),
            previewData: last,
          },
        }));
        if (last.phase) lastPhaseRef.current = last.phase;
      } catch { /* 백엔드 안 떠 있어도 다음 단계로 진행 */ }
    })().finally(() => {
      // 2) backfill 끝난 뒤 WS 연결 — 새 tick 만 추가됨 (단조성 가드는 ws.onmessage 에 있음)
      if (!cancelled) connect();
    });

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // 마운트 시 한 번 — 학습된 시간 단위 목표 전류 프로파일 fetch
  useEffect(() => {
    let cancelled = false;
    fetchCurrentProfiles().then(profiles => {
      if (cancelled || !profiles) return;
      setState(prev => ({
        ...prev,
        meta: { ...prev.meta, currentProfiles: profiles as CurrentProfiles },
      }));
    });
    return () => { cancelled = true; };
  }, []);

  const reset = useCallback(() => {
    dataRef.current = [];
    setEvents([]);
    setCompletionNotice(null);
    setFrozenHistory([]);
    lastPhaseRef.current = null;
    setState(prev => ({
      status: 'success',
      data: [],
      meta: {
        ...EMPTY_META,
        currentProfiles: prev.meta.currentProfiles ?? null,
      },
    }));
  }, []);

  return { state, reset, events, completionNotice, frozenHistory };
}
