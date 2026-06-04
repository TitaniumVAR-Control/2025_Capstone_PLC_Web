import type { VarProcessData } from '../features/monitoring/types';

/**
 * CSV 파일을 파싱하여 VarProcessData 배열로 변환
 *
 * CSV 컬럼 구조 (Android 프로젝트와 동일):
 * Index 6: timestamp (ISO-8601)
 * Index 2: voltage
 * Index 3: current
 * Index 4: vacuum
 * Index 5: height
 * Index 14: descentSpeed
 * Index 11: elapsedTime
 */
export function parseCsvData(csvText: string): VarProcessData[] {
  const lines = csvText.trim().split('\n');

  // 헤더 제거
  const dataLines = lines.slice(1);

  return dataLines
    .filter(line => line.trim() !== '')
    .map(line => parseLine(line))
    .filter((data): data is VarProcessData => data !== null);
}

function parseLine(line: string): VarProcessData | null {
  try {
    const values = line.split(',');

    if (values.length < 15) {
      return null;
    }

    return {
      timestamp: values[6] || new Date().toISOString(),
      voltage: parseFloat(values[2]) || 0,
      current: parseFloat(values[3]) || 0,
      vacuum: parseFloat(values[4]) || 0,
      descentSpeed: parseFloat(values[14]) || 0,
      elapsedTime: parseInt(values[11], 10) || 0,
    };
  } catch {
    return null;
  }
}
