import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMonitoringData } from '../hooks/useMonitoringData';
import { useTheme } from '../hooks/useTheme';
import { MonitoringChart } from './MonitoringChart';
import { PlcEventLogPanel } from './PlcEventLogPanel';
import { ThemeToggle } from './ThemeToggle';
import { ReportPage } from '../../report/components/ReportPage';
import { HistoryPage } from '../../history/components/HistoryPage';
import { PlcDiagPage } from '../../plc-diag/components/PlcDiagPage';
import { DEFAULT_MELT_RATIO, meltToDescent, descentToMelt, computeStartPosition, CYLINDER_TO_FLOOR_MM, ARC_GAP_MM } from '../../../lib/constants';

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT ?? '8000';
const API_BASE = `http://${window.location.hostname}:${BACKEND_PORT}`;
const ADMIN_WS_URL = `ws://${window.location.hostname}:${BACKEND_PORT}/ws/admin`;

// 작업자 입력 = 목표 용해량(mm). 백엔드에는 ÷ ratio 적용한 잉곳 이동 거리를 전달.
// 기본값 없음 — 작업자가 매번 직접 입력(입력 전 빈칸).

const PHASE_LABEL: Record<string, string> = {
  DESCENT_INIT: '아크 전 하강',
  APPROACH: '칩/바켓 용융',
  STABLE_MELT: '안정 용융',
};

const PROCESS_STATE_LABEL: Record<string, string> = {
  IDLE: '대기',
  POWER_ON_PRE_ARC: '아크 전 전원 ON',
  PRE_ARC_DESCENT: '아크 전 하강',
  ARC_DETECTED: '아크 감지',
  CHIP_BUCKET_MELT: '칩/바켓 용융',
  STABLE_MELT: '안정 용융',
  RPM_PRIMARY: '1차 RPM',
  TARGET_REACHED: '목표 도달',
  CYLINDER_UP: '실린더 상승',
  POWER_OFF: '전원 OFF',
  TILTING: '틸팅',
  RPM_SECONDARY: '2차 RPM',
  RPM_STOP: 'RPM 정지',
  COOLING_HOLD: '냉각 유지',
  FINISHED: '완료',
};

const PROCESS_CHECKLIST: { state: string; label: string }[] = [
  { state: 'PRE_ARC_DESCENT', label: '아크 전 하강' },
  { state: 'ARC_DETECTED', label: '첫 아크 감지' },
  { state: 'CHIP_BUCKET_MELT', label: '칩/바켓 용융' },
  { state: 'STABLE_MELT', label: '안정 용융' },
  { state: 'RPM_PRIMARY', label: '1차 RPM' },
  { state: 'TARGET_REACHED', label: '목표 도달' },
  { state: 'CYLINDER_UP', label: '실린더 상승' },
  { state: 'POWER_OFF', label: '전원 OFF' },
  { state: 'TILTING', label: '틸팅' },
  { state: 'RPM_SECONDARY', label: '2차 RPM' },
  { state: 'RPM_STOP', label: 'RPM 정지' },
  { state: 'COOLING_HOLD', label: '냉각 유지' },
  { state: 'FINISHED', label: '완료' },
];

interface AdminStatus {
  power_on: boolean;
  simulation_running: boolean;
  work_id: string;
  selected_file: string;
  started_at: string | null;
  elapsed_time: number;
  target_length_mm: number;
  cumulative_descent?: number;
  phase?: string;
  progress_pct?: number;
  process_state?: string;
  voltage_command_ratio?: number;
  melt_length_mm?: number;
  remaining_melt_mm?: number;
}

function KpiCard({ label, value, unit, accent = '', digits = 2 }: {
  label: string; value: string | number; unit: string; accent?: string; digits?: number;
}) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-primary)] shadow-sm px-4 py-2.5 flex flex-col items-center">
      <span className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold tabular-nums mt-0.5 ${accent || 'text-[var(--text-primary)]'}`}>
        {typeof value === 'number' ? value.toFixed(digits) : value}
      </span>
      <span className="text-[10px] text-[var(--text-tertiary)]">{unit}</span>
    </div>
  );
}

type MainTab = 'monitoring' | 'report' | 'history' | 'plc-test';

const TAB_LABEL: Record<MainTab, string> = {
  monitoring: '모니터링',
  report: '리포트',
  history: '이력',
  'plc-test': 'PLC 진단',
};
type StepStatus = 'done' | 'active' | 'waiting';

export function UnifiedDashboard() {
  const { dark, toggle } = useTheme();
  const { state, completionNotice, frozenHistory, reset, events, addEvent } = useMonitoringData();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('monitoring');

  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [powerOn, setPowerOn] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [dataSource, setDataSource] = useState<'sim' | 'hmi'>('sim');
  // PLC 실 송신 토글. false=dry-run(프로토콜 콜만, 장비 안 움직임), true=실 PLC 송신.
  const [plcTxEnabled, setPlcTxEnabled] = useState<boolean>(false);
  // 작업자가 매 작업마다 실측값을 직접 입력. 입력 전에는 빈칸(NaN) — 하드코딩 기본값 없음.
  // NaN 이면 inputsValid=false 라 power-on 이 막혀 백엔드 fallback 에 의존하지 않는다.
  const [meltLengthMm, setMeltLengthMm] = useState<number>(NaN);
  const [meltRatio, setMeltRatio] = useState<number>(DEFAULT_MELT_RATIO);
  // 시작위치는 칩/버켓 높이 + 잉곳 높이로 역산한다(아래 startPositionMm 미리보기).
  const [bucketHeightMm, setBucketHeightMm] = useState<number>(NaN);
  const [ingotHeightMm, setIngotHeightMm] = useState<number>(NaN);
  const [showProcessChecklist, setShowProcessChecklist] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // arc_gap 간격까지 하강하는 시작위치(lift_pos) = 818 - (칩/버켓 높이 + arc_gap + 잉곳 높이).
  // 백엔드가 동일 공식으로 S3,1 이동 목표를 다시 계산(source of truth)하며 여기서는 미리보기.
  const startPositionMm = useMemo(
    () => computeStartPosition(bucketHeightMm, ingotHeightMm),
    [bucketHeightMm, ingotHeightMm],
  );
  // 칩/버켓 높이 + 잉곳 높이 + 12 가 818 을 넘으면 시작위치가 음수 → 물리적으로 불가능.
  const startPosValid = Number.isFinite(startPositionMm) && startPositionMm > 0;

  // 시작위치 입력(칩/버켓·잉곳 높이)이 비거나 시작위치가 음수면 power-on 을 막아 백엔드
  // fallback 에 의존하지 않게 한다.
  const inputsValid =
    Number.isFinite(meltLengthMm) && meltLengthMm > 0 &&
    Number.isFinite(meltRatio) && meltRatio > 0 &&
    Number.isFinite(bucketHeightMm) && bucketHeightMm > 0 &&
    Number.isFinite(ingotHeightMm) && ingotHeightMm > 0 &&
    startPosValid;
  // 백엔드 전달용 잉곳 이동 거리 (target_length_mm) = 용해량 ÷ ratio
  const targetDescentMm = useMemo(
    () => (inputsValid ? Number(meltToDescent(meltLengthMm, meltRatio).toFixed(2)) : NaN),
    [meltLengthMm, meltRatio, inputsValid],
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(r => r.json())
      .then(d => {
        setModelLoaded(d.model_loaded);
        setRunning(d.simulation_running);
        setPowerOn(d.power_on);
        if (d.data_source === 'sim' || d.data_source === 'hmi') {
          setDataSource(d.data_source);
        }
      })
      .catch(() => {});
    fetch(`${API_BASE}/api/plc/transmission`)
      .then(r => r.json())
      .then(d => setPlcTxEnabled(Boolean(d.enabled)))
      .catch(() => {});
  }, []);

  const togglePlcTransmission = async () => {
    const next = !plcTxEnabled;
    try {
      const res = await fetch(`${API_BASE}/api/plc/transmission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) {
        const d = await res.json();
        setPlcTxEnabled(Boolean(d.enabled));
      }
    } catch (err) {
      console.error('[plc-tx-toggle] failed', err);
    }
  };

  // 실측(real PLC) 모드 토글. OFF=시뮬레이터, ON=실 PLC 센서로 AI 실운전.
  // 전원 ON/운전 중에는 변경 불가 (모드는 power-on 시점에 확정).
  const toggleRealMode = async () => {
    if (powerOn || running) return;
    const next = dataSource !== 'hmi';
    if (next) {
      const ok = window.confirm(
        '실측(실 PLC) 모드로 전환합니다.\n\n' +
        '· 전원 ON 시 시뮬레이터가 아니라 실제 PLC에서 전류·전압 등을 받아 AI가 하강속도를 계산합니다.\n' +
        "· 실측 ON 시 'PLC 송신'도 자동으로 ON 됩니다 → 계산된 명령이 실제 장비로 전송되어 잉곳이 실제로 하강합니다.\n" +
        '· 전원 ON 시 HMI 연결이 필수이며, 연결 실패 시 작업을 시작할 수 없습니다.\n\n' +
        '실측 모드로 전환하시겠습니까?'
      );
      if (!ok) return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/data-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ real: next }),
      });
      if (res.ok) {
        const d = await res.json();
        setDataSource(d.real ? 'hmi' : 'sim');
        // 실측 ON ⟺ PLC 송신 ON (백엔드가 함께 토글) — UI 상태도 동기화
        if (typeof d.plc_transmission !== 'undefined') setPlcTxEnabled(Boolean(d.plc_transmission));
      } else {
        const body = await res.text();
        alert(`실측 모드 전환 실패: ${res.status}\n${body}`);
      }
    } catch (err) {
      console.error('[real-mode-toggle] network error', err);
      alert(`실측 모드 전환 네트워크 오류: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    const ws = new WebSocket(ADMIN_WS_URL);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'status') {
          setAdminStatus(msg as AdminStatus);
          setRunning(Boolean(msg.simulation_running));
          setPowerOn(Boolean(msg.power_on));
        } else if (msg.type === 'finished') {
          setRunning(false);
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, []);

  const turnPowerOn = async () => {
    if (!inputsValid) {
      alert(
        '입력값을 확인해주세요.\n· 칩/버켓 높이·잉곳 높이·목표 용해량·환산비는 0보다 커야 합니다.\n' +
        '· 계산된 시작위치는 0보다 커야 합니다 (칩/버켓+잉곳+12 ≤ 818).',
      );
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/power-on`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_length_mm: targetDescentMm,
          // 칩/버켓·잉곳 높이를 보내면 백엔드가 12mm 간격 시작위치를 역산한다.
          bucket_height_mm: bucketHeightMm,
          ingot_height_mm: ingotHeightMm,
        }),
      });
      if (res.ok) {
        setPowerOn(true);
      } else {
        const body = await res.text();
        console.error('[power-on] failed', res.status, body);
        alert(`전원 ON 실패: ${res.status}\n${body}`);
      }
    } catch (err) {
      console.error('[power-on] network error', err);
      alert(`전원 ON 네트워크 오류: ${(err as Error).message}`);
    }
  };

  const turnPowerOff = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/power-off`, { method: 'POST' });
      if (res.ok) {
        setPowerOn(false); setRunning(false); setAdminStatus(null);
      } else {
        console.error('[power-off] failed', res.status, await res.text());
      }
    } catch (err) {
      console.error('[power-off] network error', err);
    }
  };

  const handleAbort = async () => {
    const ok = window.confirm(
      '진행 중인 공정을 중단합니다.\n\n' +
      '· 잉곳 하강이 즉시 멈추고 작업이 종료됩니다.\n' +
      '· 종료된 작업은 이력 탭과 리포트에 자동 저장됩니다.\n\n' +
      '정말 중단하시겠습니까?'
    );
    if (!ok) return;
    await turnPowerOff();
  };

  /** 종료된 공정 화면을 비우고 새 작업 입력 가능 상태로 되돌린다. */
  const handleStartNew = async () => {
    // 백엔드가 powerOn 상태로 남아 있을 수 있으므로 명시적으로 끄고 모니터링 화면으로 복귀.
    try { await fetch(`${API_BASE}/api/power-off`, { method: 'POST' }); } catch { /* ignore */ }
    setPowerOn(false);
    setRunning(false);
    setAdminStatus(null);
    reset();
    setActiveTab('monitoring');
  };

  const startSim = async () => {
    if (!inputsValid) {
      alert(
        '입력값을 확인해주세요.\n· 칩/버켓 높이·잉곳 높이·목표 용해량·환산비는 0보다 커야 합니다.\n' +
        '· 계산된 시작위치는 0보다 커야 합니다 (칩/버켓+잉곳+12 ≤ 818).',
      );
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_length_mm: targetDescentMm }),
      });
      if (res.ok) setRunning(true);
    } catch { /* ignore */ }
  };

  const stopSim = async () => {
    // 작업 중지 = 안전 정지: 실린더 강제 상승(S3,4) → 전원 OFF(S2,0) → AI OFF(S6,0).
    //   백엔드 /power-off 가 위 시퀀스를 발행하고 runner 취소 + 연결 정리까지 수행한다.
    try {
      await fetch(`${API_BASE}/api/power-off`, { method: 'POST' });
      setRunning(false); setPowerOn(false); setAdminStatus(null);
    } catch { /* ignore */ }
  };

  const reloadModel = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reload-model`, { method: 'POST' });
      const d = await res.json();
      setModelLoaded(d.success);
      addEvent(`[모델] 재로드 ${d.success ? '완료' : '실패'}`, d.success ? 'info' : 'error');
    } catch {
      addEvent('[모델] 재로드 실패: 서버 응답 없음', 'error');
    }
  };

  const { data: monitorData, meta } = state;
  const latest = monitorData[monitorData.length - 1] ?? meta.previewData ?? null;

  const fallbackTarget = Number.isFinite(targetDescentMm) ? targetDescentMm : 0;
  const targetLength = adminStatus?.target_length_mm ?? meta.targetLengthMm ?? fallbackTarget;
  // 헤더/사이드바 표시용 — 백엔드는 항상 잉곳 이동 거리로 통신하므로 ×ratio 환산.
  const targetMeltLengthMm = descentToMelt(targetLength, meltRatio);
  const cumulativeDescent = latest?.cumulativeDescent ?? adminStatus?.cumulative_descent ?? 0;
  const processState = latest?.processState ?? adminStatus?.process_state ?? null;
  const processStateLabel = processState ? PROCESS_STATE_LABEL[processState] ?? processState : '대기';
  const voltageCommandRatio = latest?.voltageCommandRatio ?? adminStatus?.voltage_command_ratio ?? null;
  const meltLength = latest?.meltLengthMm ?? adminStatus?.melt_length_mm ?? null;
  const remainingMelt = latest?.remainingMeltMm ?? adminStatus?.remaining_melt_mm ?? null;
  const rawProgress = latest?.progressPct ?? adminStatus?.progress_pct ?? (
    targetLength > 0 && meltLength != null ? (meltLength / targetLength) * 100 : 0
  );
  const progress = Math.min(100, Math.max(0, rawProgress));
  const progressText = `${progress.toFixed(1)}%`;
  const arcDetected = Boolean(latest?.arcDetected);
  const targetReached = Boolean(latest?.targetReached);
  const rpmPrimaryOn = Boolean(latest?.rpmPrimaryOn);
  const afterState = (state: string) => {
    if (!processState) return false;
    const currentIndex = PROCESS_CHECKLIST.findIndex(step => step.state === processState);
    const targetIndex = PROCESS_CHECKLIST.findIndex(step => step.state === state);
    return currentIndex > targetIndex;
  };
  const stepStatus = (state: string): StepStatus => {
    if (processState === 'FINISHED') return 'done';
    if (state === 'PRE_ARC_DESCENT') return arcDetected ? 'done' : processState === state ? 'active' : 'waiting';
    if (state === 'ARC_DETECTED') return arcDetected ? 'done' : 'waiting';
    if (state === 'CHIP_BUCKET_MELT') return afterState(state) ? 'done' : processState === state ? 'active' : 'waiting';
    if (state === 'STABLE_MELT') {
      if (targetReached) return 'done';
      return processState === 'STABLE_MELT' || processState === 'RPM_PRIMARY' ? 'active' : 'waiting';
    }
    if (state === 'RPM_PRIMARY') {
      if (afterState('RPM_PRIMARY') && !rpmPrimaryOn) return 'done';
      return rpmPrimaryOn || processState === 'RPM_PRIMARY' ? 'active' : 'waiting';
    }
    if (state === 'TARGET_REACHED') return targetReached ? (processState === state ? 'active' : 'done') : 'waiting';
    if (processState === state) return 'active';
    return afterState(state) ? 'done' : 'waiting';
  };
  const checklistItems = PROCESS_CHECKLIST.map(step => ({ ...step, status: stepStatus(step.state) }));
  const activeChecklistItems = checklistItems.filter(item => item.status === 'active');
  const currentStageText = activeChecklistItems.length > 0
    ? activeChecklistItems.map(item => item.label).join(' + ')
    : processStateLabel;
  const completedStepCount = checklistItems.filter(item => item.status === 'done').length + activeChecklistItems.length;

  // 차트는 첫 아크 발생 시점부터만 표시 — 시작위치 이동 단계는 PLC 자체 처리이고
  // 그동안의 cumulative_descent / speed 는 멜팅 공정과 무관해서 노이즈로 보임.
  // cumulative_descent 도 아크 시점을 0 으로 재시작 (= melt_length 의미)
  const arcStartIndex = monitorData.findIndex(d => d.arcDetected);
  const targetReachedIndex = monitorData.findIndex(d => d.targetReached);
  const sliceStart = arcStartIndex >= 0 ? arcStartIndex : 0;
  const sliceEnd = targetReachedIndex >= 0 ? targetReachedIndex + 1 : monitorData.length;
  const arcRefDescent = arcStartIndex >= 0 ? (monitorData[arcStartIndex].cumulativeDescent ?? 0) : 0;
  const arcRefElapsed = arcStartIndex >= 0 ? (monitorData[arcStartIndex].elapsedTime ?? 0) : 0;
  const chartHistory = monitorData.slice(sliceStart, sliceEnd).map(d => ({
    ...d,
    cumulativeDescent: (d.cumulativeDescent ?? 0) - arcRefDescent,
    elapsedTime: (d.elapsedTime ?? 0) - arcRefElapsed,
  }));
  const currentChartData = chartHistory.map(d => ({ elapsedTime: d.elapsedTime, value: d.current }));
  const voltageChartData = chartHistory.map(d => ({ elapsedTime: d.elapsedTime, value: d.voltage }));
  const vacuumChartData  = chartHistory.map(d => ({ elapsedTime: d.elapsedTime, value: d.vacuum }));
  // 매퍼가 1mm 펄스 누적식으로 동작 → 즉시 descentSpeed 는 0/1 진동.
  // 그대로 그리면 신호가 가려지므로 10초 SMA로 평균 하강 속도를 시각화.
  const SPEED_SMA_WINDOW = 10;
  const speedChartData = chartHistory.map((d, i) => {
    const start = Math.max(0, i - SPEED_SMA_WINDOW + 1);
    const window = chartHistory.slice(start, i + 1);
    const avg = window.reduce((s, p) => s + p.descentSpeed, 0) / window.length;
    return { elapsedTime: d.elapsedTime, value: avg };
  });
  // 펄스 통계 (지난 60초)
  const last60s = chartHistory.slice(-60);
  const pulseCount60s = last60s.filter(d => d.descentSpeed > 0).length;
  const avgSpeed60s = last60s.length > 0
    ? last60s.reduce((s, d) => s + d.descentSpeed, 0) / last60s.length
    : 0;
  // 2026-05 외란 차트
  const coolantChartData = chartHistory.map(d => ({ elapsedTime: d.elapsedTime, value: d.coolantTemp ?? 0 }));
  const flowChartData    = chartHistory.map(d => ({ elapsedTime: d.elapsedTime, value: d.flow ?? 0 }));
  const chamberChartData = chartHistory.map(d => ({ elapsedTime: d.elapsedTime, value: d.chamberTemp ?? 0 }));

  const sectionLabel = 'block text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2';
  const inputCls = 'w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-600 outline-none transition-colors [color-scheme:light] dark:[color-scheme:dark]';

  const isFinished = !!completionNotice;

  return (
    <div className="h-screen bg-[var(--bg-base)] flex flex-col overflow-hidden print:h-auto print:block print:overflow-visible print:bg-white">

      {/* ── 최상단 글로벌 헤더 (탭 포함) ── */}
      <header className="no-print bg-[var(--bg-surface)] border-b border-[var(--border-primary)] shadow-sm shrink-0 z-10">
        <div className="px-5 py-2 flex items-center justify-between">
          {/* 로고 + 탭 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-blue-500" />
              <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight">VAR</h1>
              {/* 모드 배지: sim → 노란 'VAR 테스트', hmi → 초록 'VAR 실운전' */}
              <span
                className={`ml-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  dataSource === 'sim'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                }`}
                title={dataSource === 'sim' ? 'SIM 모드 — 가상 데이터' : 'HMI 모드 — 실 PLC 송신'}
              >
                {dataSource === 'sim' ? 'VAR 테스트' : 'VAR 실운전'}
              </span>
            </div>
            <nav className="flex gap-1">
              {(['monitoring', 'report', 'history', 'plc-test'] as MainTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)]'
                  }`}
                >
                  {TAB_LABEL[tab]}
                </button>
              ))}
            </nav>
          </div>
          {/* 우측 상태 + 컨트롤 */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {meta.powerOn && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${meta.powerOn ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </span>
              <span className={`font-medium ${meta.powerOn ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-tertiary)]'}`}>
                {meta.powerOn ? 'ON' : 'STANDBY'}
              </span>
            </div>
            <span className="h-3.5 w-px bg-[var(--border-primary)]" />
            <span className="text-[var(--text-secondary)] tabular-nums">진행률 {progressText}</span>
            {meta.targetLengthMm > 0 && (
              <>
                <span className="h-3.5 w-px bg-[var(--border-primary)]" />
                <span className="text-[var(--text-secondary)]">
                  목표 용해 <strong className="text-[var(--text-primary)]">{targetMeltLengthMm.toFixed(0)}mm</strong>
                  <span className="ml-1 text-[10px] text-[var(--text-tertiary)]">(이동 {meta.targetLengthMm.toFixed(1)}mm)</span>
                </span>
              </>
            )}
            {isFinished && (
              <>
                <span className="h-3.5 w-px bg-[var(--border-primary)]" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓ 완료</span>
              </>
            )}
            {powerOn && !isFinished && running && (
              <>
                <span className="h-3.5 w-px bg-[var(--border-primary)]" />
                <button
                  onClick={handleAbort}
                  title="진행 중인 공정을 즉시 종료합니다"
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-bold tracking-wide transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <span className="inline-block h-2 w-2 rounded-sm bg-white" />
                  공정 중단
                </button>
              </>
            )}
            {/* 실측(real PLC) 토글: OFF = 시뮬레이터, ON = 실 PLC 센서로 AI 실운전 */}
            <span className="h-3.5 w-px bg-[var(--border-primary)]" />
            <button
              onClick={toggleRealMode}
              disabled={powerOn || running}
              title={
                powerOn || running
                  ? '실측 모드는 전원을 끈 상태에서만 변경할 수 있습니다'
                  : dataSource === 'hmi'
                    ? 'ON: 전원 ON 시 실 PLC 센서로 AI 실운전 (시뮬레이터 미사용)'
                    : 'OFF: 시뮬레이터 데이터로 동작 (실 PLC 미사용)'
              }
              className={`px-3 py-1 rounded-md text-xs font-bold tracking-wide transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                dataSource === 'hmi'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400'
                  : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-[var(--text-primary)] border border-[var(--border-primary)]'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  dataSource === 'hmi' ? 'bg-white' : 'bg-slate-400 dark:bg-slate-500'
                }`}
              />
              실측 {dataSource === 'hmi' ? 'ON' : 'OFF'}
            </button>
            {/* PLC 송신 토글: OFF = 프로토콜 콜만 (장비 안 움직임), ON = 실 PLC 송신 */}
            <span className="h-3.5 w-px bg-[var(--border-primary)]" />
            <button
              onClick={togglePlcTransmission}
              title={
                plcTxEnabled
                  ? 'ON: 매퍼가 만든 명령이 실제 HMI/PLC로 송신됩니다 (장비 동작)'
                  : 'OFF: 프로토콜 콜만 로그에 남고 실제 송신은 안 됩니다 (안전 테스트)'
              }
              className={`px-3 py-1 rounded-md text-xs font-bold tracking-wide transition-colors shadow-sm flex items-center gap-1.5 ${
                plcTxEnabled
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-400'
                  : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-[var(--text-primary)] border border-[var(--border-primary)]'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  plcTxEnabled ? 'bg-white' : 'bg-slate-400 dark:bg-slate-500'
                }`}
              />
              PLC 송신 {plcTxEnabled ? 'ON' : 'OFF'}
            </button>
            {isFinished && (
              <>
                <span className="h-3.5 w-px bg-[var(--border-primary)]" />
                <button
                  onClick={handleStartNew}
                  title="화면을 초기화하고 다음 공정 입력으로 돌아갑니다"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold tracking-wide transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  새 작업 시작
                </button>
              </>
            )}
            <span className="h-3.5 w-px bg-[var(--border-primary)]" />
            <ThemeToggle dark={dark} onToggle={toggle} />
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] transition-colors"
              title={isFullscreen ? '전체화면 종료 (Esc)' : '전체화면'}
            >
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v4m0-4h4m7 11l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0h4m-4 0v-4m11-7l5-5m0 0h-4m4 0v4" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0 0l-5-5m-7 14H4m0 0v-4m0 4l5-5m7 5h4m0 0v-4m0 4l-5-5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── 탭 콘텐츠 ── */}
      <div className="flex-1 flex overflow-hidden print:block print:overflow-visible">

      {/* 리포트 탭 */}
      {activeTab === 'report' && (
        <div className="flex-1 overflow-hidden print:block print:overflow-visible print:h-auto">
          <ReportPage frozenHistory={frozenHistory} meta={meta} isFinished={isFinished} />
        </div>
      )}

      {/* 이력 탭 */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-hidden">
          <HistoryPage />
        </div>
      )}

      {/* PLC 진단 탭 — 단위 명령(S1~S6) 발행으로 HMI/PLC 응답 검증.
          test.cmd(sim) 모드에서도 사용 가능 (백엔드 게이트가 sim 도 허용). */}
      {activeTab === 'plc-test' && (
        <div className="flex-1 overflow-auto">
          <PlcDiagPage />
        </div>
      )}

      {/* 모니터링 탭 */}
      {activeTab === 'monitoring' && (
      <div className="flex flex-1 overflow-hidden">

      {/* ── 왼쪽 사이드바 ── */}
      <aside className="w-[280px] shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-primary)] flex flex-col overflow-y-auto">

        {/* 사이드바 헤더 */}
        <div className="px-4 py-3 border-b border-[var(--border-primary)] shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-amber-500" />
            <span className="text-sm font-bold text-[var(--text-primary)]">VAR 제어</span>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 flex flex-col gap-5">

          {/* 시스템 상태 */}
          <section>
            <span className={sectionLabel}>시스템 상태</span>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {powerOn && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${powerOn ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </span>
              <span className={`text-sm font-semibold ${powerOn ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-tertiary)]'}`}>
                {powerOn ? 'ON' : 'OFF'}
              </span>
              <span className="text-[var(--border-secondary)]">·</span>
              <span className={`text-sm font-semibold ${running ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--text-tertiary)]'}`}>
                {running ? 'RUNNING' : 'READY'}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${modelLoaded
                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30'
                : 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30'}`}>
                모델 {modelLoaded ? '로드됨' : '없음'}
              </span>
              <button
                onClick={reloadModel}
                className="text-[10px] px-2 py-0.5 border border-[var(--border-primary)] rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-base)] transition-colors"
              >
                재로드
              </button>
            </div>
          </section>

          {/* 공정 설정 */}
          <section>
            <span className={sectionLabel}>공정 설정</span>
            <div className="space-y-3">
              {/* 시작위치 역산 입력: 칩/버켓 높이 + 잉곳 높이 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="bucket-height-input" className="text-xs text-[var(--text-tertiary)] block mb-1">
                    칩/버켓 높이 (mm)
                  </label>
                  <div className="relative">
                    <input
                      id="bucket-height-input"
                      type="text"
                      inputMode="decimal"
                      value={Number.isFinite(bucketHeightMm) ? bucketHeightMm : ''}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') { setBucketHeightMm(NaN); return; }
                        const v = Number(raw);
                        if (!Number.isFinite(v)) return;
                        setBucketHeightMm(v);
                      }}
                      disabled={running}
                      title="틸팅용기 바닥에 넣은 칩/버켓 높이"
                      placeholder="예: 256"
                      className={`${inputCls} pr-8`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)] pointer-events-none">
                      mm
                    </span>
                  </div>
                </div>
                <div>
                  <label htmlFor="ingot-height-input" className="text-xs text-[var(--text-tertiary)] block mb-1">
                    잉곳 높이 (mm)
                  </label>
                  <div className="relative">
                    <input
                      id="ingot-height-input"
                      type="text"
                      inputMode="decimal"
                      value={Number.isFinite(ingotHeightMm) ? ingotHeightMm : ''}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') { setIngotHeightMm(NaN); return; }
                        const v = Number(raw);
                        if (!Number.isFinite(v)) return;
                        setIngotHeightMm(v);
                      }}
                      disabled={running}
                      title="작업할 잉곳(전극) 높이"
                      placeholder="예: 280"
                      className={`${inputCls} pr-8`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)] pointer-events-none">
                      mm
                    </span>
                  </div>
                </div>
              </div>
              {/* 계산된 시작위치 (S3-1 이동 목표) — 12mm 간격까지 자동 하강 */}
              <div className={`rounded-md border px-3 py-2 ${startPosValid
                ? 'border-[var(--border-primary)] bg-[var(--bg-base)]'
                : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">시작위치 (S3-1 · {ARC_GAP_MM}mm 간격)</span>
                  <span className={`text-base font-bold tabular-nums ${startPosValid
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'}`}>
                    {Number.isFinite(startPositionMm) ? startPositionMm.toFixed(0) : '—'}
                    <span className="ml-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">mm</span>
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)] leading-tight">
                  {CYLINDER_TO_FLOOR_MM} − (칩/버켓 {Number.isFinite(bucketHeightMm) ? bucketHeightMm : '—'} + {ARC_GAP_MM} + 잉곳 {Number.isFinite(ingotHeightMm) ? ingotHeightMm : '—'}) · lift_pos 기준
                </p>
                {!startPosValid && (
                  <p className="mt-1 text-[10px] font-medium text-red-600 dark:text-red-400 leading-tight">
                    ⚠ 시작위치가 0 이하입니다 — 칩/버켓·잉곳 높이를 확인하세요
                  </p>
                )}
              </div>
              {/* 목표 용해량 */}
              <div>
                <label htmlFor="melt-length-input" className="text-xs text-[var(--text-tertiary)] block mb-1">
                  목표 용해량 (mm)
                </label>
                <div className="relative">
                  <input
                    id="melt-length-input"
                    type="text"
                    inputMode="decimal"
                    value={Number.isFinite(meltLengthMm) ? meltLengthMm : ''}
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === '') { setMeltLengthMm(NaN); return; }
                      const v = Number(raw);
                      if (!Number.isFinite(v)) return;
                      setMeltLengthMm(v);
                    }}
                    disabled={running}
                    placeholder="예: 150"
                    className={`${inputCls} pr-8`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)] pointer-events-none">
                    mm
                  </span>
                </div>
              </div>
              {/* 환산비: 안내 라인에 inline 작게 — 거의 변경 없는 값이라 advanced 톤 */}
              <div className="flex items-center justify-between gap-2 -mt-1">
                <label htmlFor="melt-ratio-input" className="text-[10px] text-[var(--text-tertiary)] leading-tight">
                  환산비 (제안 1.5 ~ 1.7배)
                </label>
                <div className="relative w-20">
                  <input
                    id="melt-ratio-input"
                    type="text"
                    inputMode="decimal"
                    value={Number.isFinite(meltRatio) ? meltRatio : ''}
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === '') { setMeltRatio(NaN); return; }
                      const v = Number(raw);
                      if (!Number.isFinite(v)) return;
                      setMeltRatio(v);
                    }}
                    disabled={running}
                    placeholder={`${DEFAULT_MELT_RATIO}`}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:ring-1 focus:ring-blue-600 outline-none text-right pr-5 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-tertiary)] pointer-events-none">
                    배
                  </span>
                </div>
              </div>
              <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-base)] px-3 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">잉곳 이동 (PLC 목표)</span>
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {inputsValid ? targetDescentMm.toFixed(2) : '—'}
                    <span className="ml-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">mm</span>
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)] leading-tight">
                  백엔드 전달 값 = 종료 기준 잉곳 이동량
                </p>
              </div>
            </div>
          </section>

          {/* 전원 제어 */}
          <section>
            <span className={sectionLabel}>전원 제어</span>
            <div className="mb-2">
              <span className={`text-xs font-semibold ${running ? 'text-blue-600 dark:text-blue-400' : powerOn ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-tertiary)]'}`}>
                {running ? 'RUNNING' : powerOn ? 'POWER ON' : 'STANDBY'}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {!powerOn && (
                <button onClick={turnPowerOn} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                  전원 ON
                </button>
              )}
              {powerOn && !running && (
                <>
                  <button onClick={startSim} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                    시작
                  </button>
                  <button onClick={turnPowerOff} className="w-full py-2.5 bg-[var(--border-primary)] hover:bg-[var(--border-secondary)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors">
                    전원 OFF
                  </button>
                </>
              )}
              {running && (
                <button onClick={stopSim} className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">
                  중지
                </button>
              )}
            </div>
          </section>

          {/* 진행 현황 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className={sectionLabel}>{showProcessChecklist ? '핵심 공정 단계' : '진행 현황'}</span>
              {showProcessChecklist && (
                <button
                  type="button"
                  onClick={() => setShowProcessChecklist(false)}
                  className="text-[10px] font-medium text-blue-600 dark:text-blue-300 hover:underline"
                >
                  진행 현황
                </button>
              )}
            </div>

            {!showProcessChecklist ? (
              <>
                <div className="space-y-1.5 text-xs mb-3">
                  {adminStatus?.work_id && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[var(--text-tertiary)] shrink-0">Work ID</span>
                      <span className="text-[var(--text-primary)] font-medium truncate">{adminStatus.work_id}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-tertiary)] shrink-0">경과시간</span>
                    <span className="text-[var(--text-primary)] font-medium tabular-nums">
                      {Math.round(meta.elapsedTime || adminStatus?.elapsed_time || 0)}초
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-tertiary)] shrink-0">누적 하강</span>
                    <span className="text-[var(--text-primary)] font-medium tabular-nums">
                      {cumulativeDescent.toFixed(1)} / {targetLength.toFixed(1)} mm
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-tertiary)] shrink-0">예상 용해 (×{meltRatio || DEFAULT_MELT_RATIO})</span>
                    <span className="text-[var(--text-primary)] font-medium tabular-nums">
                      {descentToMelt(cumulativeDescent, meltRatio || DEFAULT_MELT_RATIO).toFixed(1)} / {targetMeltLengthMm.toFixed(1)} mm
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-tertiary)] shrink-0">공정 상태</span>
                    <span className="text-[var(--text-primary)] font-medium truncate">{processStateLabel}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-tertiary)] shrink-0">전압 명령</span>
                    <span className="text-[var(--text-primary)] font-medium tabular-nums">
                      {voltageCommandRatio == null ? '-' : `${Math.round(voltageCommandRatio * 100)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-tertiary)] shrink-0">용융 길이</span>
                    <span className="text-[var(--text-primary)] font-medium tabular-nums">
                      {meltLength == null ? '-' : `${meltLength.toFixed(1)} mm`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-tertiary)] shrink-0">잔여 길이</span>
                    <span className="text-[var(--text-primary)] font-medium tabular-nums">
                      {remainingMelt == null ? '-' : `${remainingMelt.toFixed(1)} mm`}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-[var(--text-tertiary)]">진행률</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">{progressText}</span>
                </div>
                <div className="w-full bg-[var(--border-primary)] rounded-full h-2">
                  <div className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowProcessChecklist(true)}
                  className="mt-3 w-full rounded-md border border-[var(--border-primary)] bg-[var(--bg-base)] px-3 py-2 text-left hover:bg-[var(--bg-surface-alt)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">현재 공정 단계</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-300">상세 보기</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {currentStageText}
                    </span>
                  </div>
                </button>
              </>
            ) : (
              <div>
                <div className="mb-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">현재 단계</div>
                    <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {currentStageText}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[var(--text-tertiary)]">단계</div>
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-300 tabular-nums">
                      {completedStepCount} / {PROCESS_CHECKLIST.length}
                    </div>
                  </div>
                </div>
                <div className="mb-4 w-full bg-[var(--border-primary)] rounded-full h-2">
                  <div className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <div className="space-y-0.5">
                  {checklistItems.map((step, index) => {
                    const done = step.status === 'done';
                    const active = step.status === 'active';
                    return (
                      <div key={step.state} className="relative flex gap-2.5 pb-2 text-xs">
                        {index < checklistItems.length - 1 && (
                          <span
                            className={`absolute left-[7px] top-4 h-full w-px ${done ? 'bg-blue-600 dark:bg-blue-400' : 'bg-[var(--border-primary)]'}`}
                          />
                        )}
                        <span
                          className={`relative z-10 h-4 w-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            done
                              ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-400 dark:border-blue-400 dark:text-slate-950'
                              : active
                                ? 'bg-[var(--bg-surface)] border-blue-600 text-blue-600 dark:border-blue-300 dark:text-blue-300'
                                : 'bg-[var(--bg-surface)] border-[var(--border-secondary)] text-transparent'
                          }`}
                        >
                          {done ? '✓' : active ? '' : ''}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={`${done ? 'text-[var(--text-secondary)]' : active ? 'text-blue-600 dark:text-blue-300 font-semibold' : 'text-[var(--text-tertiary)]'}`}>
                            {step.label}
                          </div>
                          {active && <div className="text-[10px] text-[var(--text-tertiary)]">진행 중</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>

      {/* ── 오른쪽: KPI + 차트 ── */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* 메인 콘텐츠 */}
        <main className="flex-1 px-4 py-2 flex flex-col gap-2 min-h-0">

          {/* 작업 완료 알림 */}
          {completionNotice && (
            <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold">작업 종료</span>
                  <span className="text-emerald-600/90 dark:text-emerald-300/90">
                    {completionNotice.workId || meta.workId || 'simulation'} 공정이 완료되었습니다.
                  </span>
                </div>
                <span className="text-xs tabular-nums text-emerald-600/90 dark:text-emerald-300/90">{completionNotice.finishedAt}</span>
              </div>
            </div>
          )}

          {/* KPI grid — 좌측 구간 카드(1x2, 세로 합친 한 칸 폭) + 우측 8개 KPI(2x4) */}
          <section className="grid grid-cols-5 grid-rows-2 gap-2 shrink-0">
            {/* 구간 강조 — 좌측 row-span-2 한 칸 폭.
                 표시 우선순위: process_state(PLC 15단계) > phase(ML 3단계).
                 후처리 단계(RPM/실린더/POWER_OFF/틸팅 등)에선 전류가 떨어져 ML phase가 APPROACH로
                 되돌아가는데, process_state가 정확한 공정 단계를 추적하므로 그걸 우선 표시. */}
            <div className="row-span-2 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-primary)] shadow-sm px-4 py-3 flex flex-col justify-center items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">현재 구간</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 leading-tight text-center">
                {(latest?.processState && PROCESS_STATE_LABEL[latest.processState])
                  ?? PHASE_LABEL[latest?.phase ?? '']
                  ?? '대기'}
              </span>
              {latest?.phase && state.meta.phaseEnteredAt && state.meta.phaseEnteredAt[latest.phase] !== undefined ? (
                <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                  +{Math.max(0, (latest.elapsedTime ?? 0) - (state.meta.phaseEnteredAt[latest.phase] ?? 0))}s
                </span>
              ) : null}
            </div>

            {/* 1행: 진행률 / 전류 / 전압 / 진공도 — 전압/전류는 정수단위 (PLC 정수 제어) */}
            <KpiCard label="진행률"     value={latest?.progressPct ?? 0}   unit="%"     accent="text-blue-600 dark:text-blue-400" />
            <KpiCard label="전류"       value={latest?.current ?? 0}       unit="A"     accent="text-sky-600 dark:text-sky-400"     digits={0} />
            <KpiCard label="전압"       value={latest?.voltage ?? 0}       unit="V"     accent="text-violet-600 dark:text-violet-400" digits={0} />
            <KpiCard label="진공도"     value={latest?.vacuum ?? 0}        unit="Torr"  accent="text-emerald-600 dark:text-emerald-400" digits={4} />

            {/* 2행: 하강속도 / 냉각수 온도 / 유량 / 챔버 온도 */}
            <KpiCard label="하강속도(평균)" value={avgSpeed60s}  unit="mm/s"  accent="text-rose-600 dark:text-rose-400" />
            <KpiCard label="냉각수 온도" value={latest?.coolantTemp ?? 0}   unit="°C"    accent="text-cyan-600 dark:text-cyan-400"   digits={0} />
            <KpiCard label="유량"       value={latest?.flow ?? 0}          unit="L/min" accent="text-teal-600 dark:text-teal-400"   digits={0} />
            <KpiCard label="챔버 온도"  value={latest?.chamberTemp ?? 0}   unit="°C"    accent="text-amber-600 dark:text-amber-400" digits={0} />
          </section>

          {/* 메인 차트 (전류/전압/진공도/하강속도) */}
          <section className="grid grid-cols-2 auto-rows-fr gap-3 flex-1 min-h-0">
            <MonitoringChart data={currentChartData} title="전류 (A)"         unit="A"    color="#0284c7" />
            <MonitoringChart data={voltageChartData} title="전압 (V)"         unit="V"    color="#7c3aed" />
            <MonitoringChart data={vacuumChartData}  title="진공도 (Torr)"    unit="Torr" color="#059669" />
            <MonitoringChart
              data={speedChartData}
              title="하강속도 평균 (mm/s)"
              unit="mm/s"
              color="#e11d48"
              extraInfo={`${pulseCount60s}펄스/min`}
            />
          </section>

          {/* 외란 차트 (냉각수 온도/유량/챔버 온도) — 1행 3열 */}
          <section className="grid grid-cols-3 gap-3 shrink-0" style={{ minHeight: 150 }}>
            <MonitoringChart data={coolantChartData}  title="냉각수 온도 (°C)" unit="°C"    color="#0891b2" />
            <MonitoringChart data={flowChartData}     title="유량 (L/min)"     unit="L/min" color="#0d9488" />
            <MonitoringChart data={chamberChartData}  title="챔버 온도 (°C)"   unit="°C"    color="#d97706" />
          </section>

          {/* PLC 명령 로그 — 매퍼가 매 tick 에 어떤 S 명령을 발행했는지 평가용 (sim/hmi 모두) */}
          <section className="shrink-0" style={{ height: 150 }}>
            <PlcEventLogPanel events={events} />
          </section>
        </main>
      </div>
      </div>
      )}
      </div>
    </div>
  );
}
