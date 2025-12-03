/**
 * VAR 공정 데이터 모델
 * Android 앱과 동일한 구조
 */
export interface VarProcessData {
  timestamp: string;      // ISO-8601 형식
  voltage: number;        // 전압 (V)
  current: number;        // 전류 (A)
  vacuum: number;         // 진공도 (Torr)
  height: number;         // 높이 (mm)
  descentSpeed: number;   // 하강속도 (mm/s)
  elapsedTime: number;    // 경과시간 (초)
}

/**
 * 모니터링 UI 상태
 */
export type MonitoringState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: VarProcessData[] };

/**
 * 차트 데이터 포인트
 */
export interface ChartDataPoint {
  timestamp: string;
  value: number;
}
