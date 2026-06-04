import { useState, useMemo } from 'react';
import type { VarProcessData, MonitoringMeta } from '../../monitoring/types';
import { buildAutoFields } from '../utils/reportUtils';
import { useReportForm } from '../hooks/useReportForm';
import { ProcessInfoReport } from './ProcessInfoReport';
import { GraphReport } from './GraphReport';

interface Props {
  frozenHistory: VarProcessData[];
  meta: MonitoringMeta;
  isFinished: boolean;
  /** 이력 탭에서 과거 작업을 다시 볼 때 true. 인쇄 항상 활성, 진행 경고 메시지 숨김. */
  readOnly?: boolean;
}

type SubTab = 'process' | 'graph';

export function ReportPage({ frozenHistory, meta, isFinished, readOnly = false }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('process');
  const { formData, updateField, updatePhoto } = useReportForm(meta.workId);
  const auto = useMemo(() => buildAutoFields(frozenHistory, meta), [frozenHistory, meta]);
  const canPrint = isFinished || readOnly;
  const graphData = useMemo(() => {
    const targetReachedIndex = frozenHistory.findIndex(d => d.targetReached);
    return targetReachedIndex >= 0 ? frozenHistory.slice(0, targetReachedIndex + 1) : frozenHistory;
  }, [frozenHistory]);

  const handlePrint = () => window.print();

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)] print:block print:h-auto print:bg-white">

      {/* 리포트 서브 헤더 */}
      <div className="no-print flex items-center justify-between px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-primary)] shrink-0">
        <div className="flex gap-1">
          {(['process', 'graph'] as SubTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                subTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)]'
              }`}
            >
              {tab === 'process' ? '공정정보' : '그래프'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!isFinished && !readOnly && (
            <span className="text-xs text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded px-2 py-1">
              ⚠ 공정 완료 후 자동입력 필드가 채워집니다
            </span>
          )}
          <button
            onClick={handlePrint}
            disabled={!canPrint}
            title={!canPrint ? '공정 완료 후 사용 가능' : '브라우저 인쇄 / PDF 저장'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              canPrint
                ? 'bg-slate-700 text-white hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            인쇄 / PDF 저장
          </button>
        </div>
      </div>

      {/* 리포트 본문 — 스크롤 가능 */}
      <div className="flex-1 overflow-auto print:overflow-visible print:flex-none print:h-auto relative">
        {/* 인쇄 시 제목 표시 */}
        <div className="hidden print:block text-center text-lg font-bold py-3 border-b border-slate-300">
          VAR REPORT
        </div>

        {/* 공정정보 — 비활성 시에도 마운트 유지 (차트 측정용 일관성) */}
        <div className={
          subTab === 'process'
            ? ''
            : 'absolute inset-0 opacity-0 pointer-events-none -z-10 print:static print:opacity-100 print:z-auto print:pointer-events-auto'
        }>
          <ProcessInfoReport
            auto={auto}
            form={formData}
            onField={updateField}
            onPhoto={updatePhoto}
          />
        </div>

        {/* 그래프 — 비활성 시에도 항상 마운트되어야 Recharts ResponsiveContainer가 정상 측정함 */}
        <div className={`${
          subTab === 'graph'
            ? 'h-full print:h-auto'
            : 'absolute inset-0 opacity-0 pointer-events-none -z-10 print:static print:opacity-100 print:z-auto print:pointer-events-auto'
        } print-graph-section`}>
          <GraphReport data={graphData} />
        </div>
      </div>
    </div>
  );
}
