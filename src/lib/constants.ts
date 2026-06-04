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
