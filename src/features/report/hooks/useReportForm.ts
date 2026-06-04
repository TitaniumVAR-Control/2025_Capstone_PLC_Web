import { useState, useEffect, useCallback } from 'react';
import type { ReportFormData } from '../types';

const DEFAULT_FORM: ReportFormData = {
  customerId: '',
  partNo: '',
  dwgNo: '',
  rsNo: '',
  productName: '',
  planPeriod: '',
  heatNo: '',
  ingotDiameter: '',
  ingotLength: '',
  manufacturer: '',
  skullBefore: '',
  skullAfter: '',
  casting1: '',
  casting2: '',
  casting3: '',
  casting4: '',
  sprue: '',
  tundish: '',
  photos: [null, null, null, null, null],
};

function storageKey(workId: string) {
  return `ax-report-form-${workId || 'default'}`;
}

export function useReportForm(workId: string) {
  const [formData, setFormData] = useState<ReportFormData>(() => {
    try {
      const saved = localStorage.getItem(storageKey(workId));
      if (saved) return { ...DEFAULT_FORM, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return DEFAULT_FORM;
  });

  // workId 바뀌면 해당 workId의 저장값 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(workId));
      if (saved) {
        setFormData({ ...DEFAULT_FORM, ...JSON.parse(saved) });
        return;
      }
    } catch { /* ignore */ }
    setFormData(DEFAULT_FORM);
  }, [workId]);

  // formData 변경 시 자동 저장
  useEffect(() => {
    try {
      // photos는 objectURL이라 직렬화 제외
      const { photos: _, ...rest } = formData;
      localStorage.setItem(storageKey(workId), JSON.stringify(rest));
    } catch { /* ignore */ }
  }, [formData, workId]);

  const updateField = useCallback(<K extends keyof ReportFormData>(key: K, value: ReportFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const updatePhoto = useCallback((index: number, file: File | null) => {
    setFormData(prev => {
      const photos = [...prev.photos];
      if (file) {
        photos[index] = URL.createObjectURL(file);
      } else {
        photos[index] = null;
      }
      return { ...prev, photos };
    });
  }, []);

  return { formData, updateField, updatePhoto };
}
