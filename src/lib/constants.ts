// VAR 공정 환산 상수
// 박병선 (회사) 안내 (2026-05): 잉곳 1mm 이동 시 실제 용해 길이는 1.5~1.7mm
// → 중간값 1.6을 기본값으로 사용. 실측치에 맞춰 UI에서 조정 가능.
export const DEFAULT_MELT_RATIO = 1.6;

// 용해량(mm) → 잉곳 이동 거리(mm). ratio 미지정 시 기본값 사용.
export const meltToDescent = (meltMm: number, ratio: number = DEFAULT_MELT_RATIO): number =>
  meltMm / ratio;

// 잉곳 이동 거리(mm) → 예상 용해량(mm).
export const descentToMelt = (descentMm: number, ratio: number = DEFAULT_MELT_RATIO): number =>
  descentMm * ratio;

// ── 시작위치 자동 계산 기구 상수 (현장 실측) ──
// 실린더 원점(lift_pos=0, 완전 상승)에서 틸팅용기 바닥면까지의 높이(mm).
// ※ 백엔드 config.py(cylinder_to_floor_mm)가 실제 S3,1 값의 source of truth.
//    여기 값은 작업자 미리보기용 — 둘은 항상 같게 유지할 것.
export const CYLINDER_TO_FLOOR_MM = 818;
// 첫 아크 직전 잉곳 바닥 ~ 칩/버켓 윗면 목표 간격(mm). 이 간격까지 빠르게 하강한 뒤
// 1mm 펄스로 천천히 내려가다 첫 아크가 튀면 작업 시작.
// ※ 백엔드 config.py(arc_gap_mm)와 항상 같게 유지할 것 (현재 10).
export const ARC_GAP_MM = 10;

// 칩/버켓 높이 + 잉곳 높이 → arc_gap 간격 시작위치(lift_pos mm, = S3,1 이동 목표).
export const computeStartPosition = (bucketMm: number, ingotMm: number): number =>
  CYLINDER_TO_FLOOR_MM - (bucketMm + ARC_GAP_MM + ingotMm);
