export interface ReportFormData {
  // 고객정보
  customerId: string;
  partNo: string;
  dwgNo: string;
  // Routing Sheet 정보
  rsNo: string;
  productName: string;
  planPeriod: string;
  // Heat 정보 (Heat No.는 수동 입력)
  heatNo: string;
  ingotDiameter: string;
  ingotLength: string;
  manufacturer: string;
  // SKULL 관리 (작업자 직접 측정)
  skullBefore: string;
  skullAfter: string;
  // 주조품 관리
  casting1: string;
  casting2: string;
  casting3: string;
  casting4: string;
  sprue: string;
  tundish: string;
  // 주조 공정 사진 (최대 5장, base64 or objectURL)
  photos: (string | null)[];
}

export interface StatValues {
  avg: string;
  std: string;
  max: string;
  min: string;
}

export interface ReportAutoData {
  workDate: string;
  logData: string;
  // 진공도 (phase별 시간)
  vacuumInitTime: string;
  vacuumMeltTime: string;
  vacuumCoolTime: string;
  // 전압 (아크/용융 구간)
  voltageArc: StatValues;
  voltageMelt: StatValues;
  // 전류 (아크/용융 구간)
  currentArc: StatValues;
  currentMelt: StatValues;
  // 온도 — 미연동
  tempArc: StatValues;
  tempMelt: StatValues;
  // 냉각수 — 미연동
  coolingChamber: StatValues;
  coolingGunTop: StatValues;
  coolingGunBottom: StatValues;
  coolingFlow: StatValues;
  // 용해량 관리 (모니터링 단계 입력값 — 미연동)
  initialWeight: string;
  targetWeight: string;
  theoreticalMelt: string;
  theoreticalMeltRaw: number;   // 증감 계산용 숫자 원값
  arcTime: string;
  meltTime: string;
  totalTime: string;
  // 틸팅 정보 (모니터링 단계 설정값 — 미연동)
  tilting1Rpm: string;
  tilting1Angle: string;
  tilting2Rpm: string;
  tilting2Angle: string;
  tilting3Rpm: string;
  tilting3Angle: string;
  // RPM 정보 — 미연동
  rpm1: string;
  rpmTime1: string;
  rpm2: string;
  rpmTime2: string;
  rpmHold: string;
  rpmHoldTime: string;
  // 용탕 주입 — 미연동
  pourTime: string;
  pourSpeed: string;
  // 공정 스냅샷 사진 — 미연동 (자동 촬영)
  snapshotArc: string | null;
  snapshotMelt: string | null;
  snapshotTilting1: string | null;
  snapshotTilting2: string | null;
  snapshotTilting3: string | null;
  snapshotRpm: string | null;
}

export const PENDING = '—';
