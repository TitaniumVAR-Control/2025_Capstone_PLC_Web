import { useState, useMemo } from 'react';
import { useHistoryList } from '../hooks/useHistoryList';
import { useHistoryDetail } from '../hooks/useHistoryDetail';
import { ReportPage } from '../../report/components/ReportPage';
import type { MonitoringMeta } from '../../monitoring/types';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso; }
}

function endReasonBadge(reason: string): { label: string; cls: string } {
  if (reason === 'normal') return { label: '정상', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' };
  if (reason === 'cancel') return { label: '중단', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' };
  if (reason === 'error')  return { label: '오류', cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' };
  return { label: reason || '-', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
}

export function HistoryPage() {
  const { items, loading, error, refresh } = useHistoryList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { payload, loading: detailLoading } = useHistoryDetail(selectedId);

  // payload.meta(ReportMeta) → MonitoringMeta로 변환해 ReportPage 재사용.
  const monitoringMeta: MonitoringMeta | null = useMemo(() => {
    if (!payload) return null;
    const lastTick = payload.timeseries[payload.timeseries.length - 1];
    return {
      powerOn: false,
      simulationRunning: false,
      workId: payload.meta.workId,
      selectedFile: payload.meta.selectedFile,
      startedAt: payload.meta.startedAt,
      elapsedTime: lastTick?.elapsedTime ?? 0,
      targetLengthMm: payload.meta.targetLengthMm,
      previewData: null,
    };
  }, [payload]);

  return (
    <div className="flex flex-1 overflow-hidden bg-[var(--bg-base)]">
      {/* 좌측 목록 */}
      <aside className="w-[360px] shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-primary)] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-purple-500" />
            <span className="text-sm font-bold text-[var(--text-primary)]">과거 작업 이력</span>
          </div>
          <button
            onClick={refresh}
            className="text-[10px] px-2 py-1 rounded-md border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] transition-colors"
          >
            새로고침
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-tertiary)]">
            불러오는 중...
          </div>
        )}
        {error && (
          <div className="flex-1 flex items-center justify-center text-xs text-red-500 px-4 text-center">
            목록을 가져오지 못했습니다 ({error}). 백엔드 연결을 확인하세요.
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-tertiary)] px-4 text-center">
            저장된 작업이 없습니다.<br />
            공정이 한 번 완료되면 자동으로 이곳에 표시됩니다.
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {items.map(item => {
            const isSelected = item.reportId === selectedId;
            const badge = endReasonBadge(item.endReason);
            return (
              <button
                key={item.reportId}
                onClick={() => setSelectedId(item.reportId)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--border-secondary)] transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-l-blue-500'
                    : 'hover:bg-[var(--bg-surface-alt)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-[var(--text-primary)] truncate flex-1">
                    {item.workId || item.reportId}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                  {fmtDate(item.startedAt)}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--text-secondary)]">
                  <span>목표 <strong className="tabular-nums">{item.targetLengthMm.toFixed(0)}mm</strong></span>
                  <span>·</span>
                  <span>틱 <strong className="tabular-nums">{item.totalRows}</strong></span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* 우측 상세 */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!selectedId && (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
            좌측 목록에서 작업을 선택하면 상세 정보가 표시됩니다.
          </div>
        )}

        {selectedId && detailLoading && (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
            상세 정보를 불러오는 중...
          </div>
        )}

        {selectedId && !detailLoading && payload && monitoringMeta && (
          <>
            {/* 상단 메타 카드 (간략) */}
            <section className="no-print shrink-0 px-5 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-primary)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <Meta label="Work ID" value={payload.meta.workId} />
                <Meta label="시작 시각" value={fmtDate(payload.meta.startedAt)} />
                <Meta label="종료 시각" value={fmtDate(payload.meta.endedAt)} />
                <Meta label="종료 사유" value={endReasonBadge(payload.meta.endReason).label} />
              </div>
            </section>

            {/* 리포트 본문 — 공정정보 + 그래프 + 인쇄 (모니터링 리포트 탭과 동일 UI) */}
            <section className="flex-1 min-h-0 overflow-hidden">
              <ReportPage
                frozenHistory={payload.timeseries}
                meta={monitoringMeta}
                isFinished={true}
                readOnly={true}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{value}</div>
    </div>
  );
}
