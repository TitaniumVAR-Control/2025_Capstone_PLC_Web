import type { VarProcessData, MonitoringMeta } from '../../monitoring/types';
import type { ReportAutoData, StatValues } from '../types';
import { PENDING } from '../types';

function calcStats(values: number[]): StatValues {
  if (values.length === 0) return { avg: PENDING, std: PENDING, max: PENDING, min: PENDING };
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  return {
    avg: avg.toFixed(2),
    std: std.toFixed(2),
    max: Math.max(...values).toFixed(2),
    min: Math.min(...values).toFixed(2),
  };
}

function splitByPhase(data: VarProcessData[]) {
  const arc = data.filter(d => d.phase === 'DESCENT_INIT' || d.phase === 'APPROACH');
  const melt = data.filter(d => d.phase === 'STABLE_MELT');
  return { arc, melt };
}

function fmtTime(seconds: number): string {
  if (!seconds) return PENDING;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return PENDING;
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

const MOCK_PROCESS_VALUES = {
  tiltingRpm: '20 RPM',
  tiltingAngle: '90°',
  rpmPrimary: '30 RPM',
  rpmSecondary: '20 RPM',
  rpmHold: '0 RPM',
};

function firstByState(data: VarProcessData[], state: string) {
  return data.find(d => d.processState === state);
}

function lastByState(data: VarProcessData[], state: string) {
  return [...data].reverse().find(d => d.processState === state);
}

function elapsedBetween(start?: VarProcessData, end?: VarProcessData): number {
  if (!start || !end) return 0;
  return Math.max(0, end.elapsedTime - start.elapsedTime);
}

/**
 * 단일 진입점 — 새 서버 데이터 추가 시 이 함수만 수정
 */
export function buildAutoFields(data: VarProcessData[], meta: MonitoringMeta): ReportAutoData {
  const { arc, melt } = splitByPhase(data);

  const targetReached = data.find(d => d.targetReached);
  const coolingStart = firstByState(data, 'COOLING_HOLD');
  const finished = firstByState(data, 'FINISHED') ?? data[data.length - 1];
  const rpmPrimaryStart = data.find(d => d.rpmPrimaryOn);
  const rpmPrimaryEnd = targetReached;
  const rpmSecondaryStart = firstByState(data, 'RPM_SECONDARY');
  const rpmSecondaryEnd = lastByState(data, 'RPM_SECONDARY');
  const tiltingStart = firstByState(data, 'TILTING');
  const tiltingEnd = lastByState(data, 'TILTING');
  const rpmStop = firstByState(data, 'RPM_STOP');

  const arcElapsed = arc.length > 0 ? arc[arc.length - 1].elapsedTime - arc[0].elapsedTime : 0;
  const meltElapsed = targetReached && data.find(d => d.arcDetected)
    ? targetReached.elapsedTime - (data.find(d => d.arcDetected)?.elapsedTime ?? targetReached.elapsedTime)
    : melt.length > 0 ? melt[melt.length - 1].elapsedTime - melt[0].elapsedTime : 0;
  const totalElapsed = data.length > 0 ? data[data.length - 1].elapsedTime : 0;

  const vacuumInit = data.find(d => d.phase === 'DESCENT_INIT');
  const vacuumMelt = data.find(d => d.phase === 'STABLE_MELT');
  const vacuumCool = coolingStart;

  const lastMeltLength = targetReached?.meltLengthMm ?? data.reduce((max, d) => Math.max(max, d.meltLengthMm ?? 0), 0);
  const targetLength = meta.targetLengthMm || targetReached?.targetLengthMm || data[0]?.targetLengthMm || 0;
  const rpmPrimaryTime = elapsedBetween(rpmPrimaryStart, rpmPrimaryEnd);
  const rpmSecondaryTime = elapsedBetween(rpmSecondaryStart, rpmSecondaryEnd);
  const tiltingTime = elapsedBetween(tiltingStart, tiltingEnd);
  const coolingTime = elapsedBetween(coolingStart, finished);

  return {
    workDate: fmtDate(meta.startedAt),
    logData: meta.workId || PENDING,

    vacuumInitTime: vacuumInit ? `${vacuumInit.vacuum.toFixed(3)} Torr` : PENDING,
    vacuumMeltTime: vacuumMelt ? `${vacuumMelt.vacuum.toFixed(3)} Torr` : PENDING,
    vacuumCoolTime: vacuumCool ? `${vacuumCool.vacuum.toFixed(3)} Torr` : PENDING,

    voltageArc: calcStats(arc.map(d => d.voltage)),
    voltageMelt: calcStats(melt.map(d => d.voltage)),
    currentArc: calcStats(arc.map(d => d.current)),
    currentMelt: calcStats(melt.map(d => d.current)),

    // 2026-05 외란 변수 — 시계열에서 실통계 산출
    //   리포트 UI 4행 매핑: 챔버상부=챔버온도 / GUN상부=냉각수온도 / GUN하부=챔버온도(중복) / 유량=유량
    //   (PLC 추가 측정점이 들어오면 GUN하부를 분리)
    tempArc: calcStats(arc.map(d => d.chamberTemp ?? 0).filter(v => v > 0)),
    tempMelt: calcStats(melt.map(d => d.chamberTemp ?? 0).filter(v => v > 0)),
    coolingChamber: calcStats(data.map(d => d.chamberTemp ?? 0).filter(v => v > 0)),
    coolingGunTop: calcStats(data.map(d => d.coolantTemp ?? 0).filter(v => v > 0)),
    coolingGunBottom: calcStats(data.map(d => d.chamberTemp ?? 0).filter(v => v > 0)),
    coolingFlow: calcStats(data.map(d => d.flow ?? 0).filter(v => v > 0)),

    // 용해량 관리 (초기값/목표값은 모니터링 단계 연동 시 채워짐)
    initialWeight: '0.0 mm',
    targetWeight: targetLength > 0 ? `${targetLength.toFixed(1)} mm` : PENDING,
    theoreticalMelt: lastMeltLength > 0 ? `${lastMeltLength.toFixed(1)} mm` : PENDING,
    theoreticalMeltRaw: lastMeltLength,
    arcTime: fmtTime(arcElapsed),
    meltTime: fmtTime(meltElapsed),
    totalTime: fmtTime(totalElapsed),

    tilting1Rpm: tiltingStart ? MOCK_PROCESS_VALUES.tiltingRpm : PENDING,
    tilting1Angle: tiltingStart ? `${MOCK_PROCESS_VALUES.tiltingAngle} / ${fmtTime(tiltingTime)}` : PENDING,
    tilting2Rpm: PENDING, tilting2Angle: PENDING,
    tilting3Rpm: PENDING, tilting3Angle: PENDING,

    rpm1: rpmPrimaryStart ? MOCK_PROCESS_VALUES.rpmPrimary : PENDING,
    rpmTime1: rpmPrimaryStart ? fmtTime(rpmPrimaryTime) : PENDING,
    rpm2: rpmSecondaryStart ? MOCK_PROCESS_VALUES.rpmSecondary : PENDING,
    rpmTime2: rpmSecondaryStart ? fmtTime(rpmSecondaryTime) : PENDING,
    rpmHold: coolingStart ? MOCK_PROCESS_VALUES.rpmHold : PENDING,
    rpmHoldTime: coolingStart ? fmtTime(coolingTime) : PENDING,

    pourTime: tiltingStart ? fmtTime(tiltingTime || elapsedBetween(tiltingStart, rpmStop)) : PENDING,
    pourSpeed: tiltingStart ? '자동 틸팅' : PENDING,

    // 공정 스냅샷 — 모니터링 단계 자동 촬영 연동 시 채워짐
    snapshotArc: null,
    snapshotMelt: null,
    snapshotTilting1: null,
    snapshotTilting2: null,
    snapshotTilting3: null,
    snapshotRpm: null,
  };
}
