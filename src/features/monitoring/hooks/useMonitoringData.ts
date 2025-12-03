import { useState, useEffect, useRef, useCallback } from 'react';
import type { VarProcessData, MonitoringState } from '../types';
import { parseCsvData } from '../../../lib/csv-parser';

const WINDOW_SIZE = 6; // 슬라이딩 윈도우 크기 (최근 6개 데이터)
const UPDATE_INTERVAL = 1000; // 1초 간격

/**
 * 실시간 모니터링 데이터 훅
 * CSV 파일에서 데이터를 로드하고 1초 간격으로 시뮬레이션
 */
export function useMonitoringData(csvFileName: string = 'SA00000_20250715_W003.csv') {
  const [state, setState] = useState<MonitoringState>({ status: 'loading' });
  const [currentIndex, setCurrentIndex] = useState(0);
  const allDataRef = useRef<VarProcessData[]>([]);
  const intervalRef = useRef<number | null>(null);

  // CSV 데이터 로드
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/data/${csvFileName}`);
        if (!response.ok) {
          throw new Error(`Failed to load CSV: ${response.status}`);
        }
        const csvText = await response.text();
        const parsedData = parseCsvData(csvText);

        if (parsedData.length === 0) {
          throw new Error('No data found in CSV');
        }

        allDataRef.current = parsedData;
        setCurrentIndex(0);
        setState({
          status: 'success',
          data: parsedData.slice(0, 1),
        });
      } catch (error) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    loadData();
  }, [csvFileName]);

  // 실시간 시뮬레이션 (1초마다 데이터 추가)
  useEffect(() => {
    if (state.status !== 'success' || allDataRef.current.length === 0) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setCurrentIndex(prev => {
        const nextIndex = prev + 1;
        if (nextIndex >= allDataRef.current.length) {
          // 데이터 끝에 도달하면 처음부터 다시
          return 0;
        }
        return nextIndex;
      });
    }, UPDATE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.status]);

  // 현재 인덱스가 변경되면 슬라이딩 윈도우 데이터 업데이트
  useEffect(() => {
    if (state.status !== 'success') return;

    const startIndex = Math.max(0, currentIndex - WINDOW_SIZE + 1);
    const windowData = allDataRef.current.slice(startIndex, currentIndex + 1);

    setState({
      status: 'success',
      data: windowData,
    });
  }, [currentIndex]);

  // 데이터 리셋
  const reset = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  return { state, reset, currentIndex, totalCount: allDataRef.current.length };
}
