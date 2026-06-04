/**
 * VAR 공정 데이터 모델 — Rule + ARX 보정 제어 v2
 */
export interface VarProcessData {
  timestamp: string;
  current: number;            // 전류 (A)
  vacuum: number;             // 진공도 (Torr)
  voltage: number;            // 전압 (V)
  descentSpeed: number;       // 하강속도 (cm/s)
  elapsedTime: number;        // 경과시간 (초)
  recommendedSpeed?: number | null;   // AI 추천 속도
  predictedCurrent?: number | null;   // 예측 전류
  targetLengthMm?: number | null;     // 목표 잉곳 길이 (mm)
  cumulativeDescent?: number | null;  // 누적 하강량 (mm)
  phase?: string | null;              // 공정 구간 (DESCENT_INIT / APPROACH / STABLE_MELT)
  progressPct?: number | null;        // 진행률 (%)
  processState?: string | null;       // AI 공정 시퀀스 상태
  voltageCommandRatio?: number | null;// 외부 전압 명령 비율
  meltLengthMm?: number | null;       // 첫 아크 이후 용융 길이 (mm)
  remainingMeltMm?: number | null;    // 목표 용융 길이까지 남은 길이 (mm)
  arcDetected?: boolean;
  targetReached?: boolean;
  rpmPrimaryOn?: boolean;
  rpmSecondaryOn?: boolean;
  tiltingOn?: boolean;
  coolingOn?: boolean;
  processEvent?: string | null;
  // 2026-05 신규 외란 변수
  coolantTemp?: number | null;        // 냉각수 온도 (°C)
  flow?: number | null;               // 유량 (L/min)
  chamberTemp?: number | null;        // 챔버 온도 (°C)
}

/**
 * phase별 시간 단위 목표 전류 프로파일.
 * 백엔드 `/api/current-profiles` 응답을 그대로 보관.
 * 모니터링 화면이 전류 그래프 overlay에 사용.
 */
export interface CurrentProfiles {
  loaded: boolean;
  profiles: Record<string, number[]>;            // { APPROACH: [...], STABLE_MELT: [...] }
  reference_currents: Record<string, number>;    // phase별 단일 reference (fallback)
  rule_speeds: Record<string, number>;
}

export interface MonitoringMeta {
  powerOn: boolean;
  simulationRunning: boolean;
  workId: string;
  selectedFile: string;
  startedAt: string | null;
  elapsedTime: number;
  targetLengthMm: number;
  previewData: VarProcessData | null;
  // 2026-05 시간 단위 목표 전류 프로파일 (status 폴링 또는 마운트 시 1회 fetch)
  currentProfiles?: CurrentProfiles | null;
  // phase 진입 시점 (process_state 또는 phase 전환 보고 클라이언트가 기록)
  phaseEnteredAt?: Record<string, number>;
}

/**
 * 모니터링 UI 상태
 */
export type MonitoringState =
  | { status: 'loading'; data: VarProcessData[]; meta: MonitoringMeta }
  | { status: 'error'; message: string; data: VarProcessData[]; meta: MonitoringMeta }
  | { status: 'success'; data: VarProcessData[]; meta: MonitoringMeta };

/**
 * 차트 데이터 포인트
 */
export interface ChartDataPoint {
  timestamp: string;
  value: number;
}

/**
 * 이벤트 로그 항목
 */
export interface EventLogEntry {
  time: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
}
