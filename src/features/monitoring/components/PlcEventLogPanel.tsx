import type { EventLogEntry } from '../types';

interface Props {
  events: EventLogEntry[];
  /** 표시할 최대 항목 수 (최근 N개) */
  maxItems?: number;
}

/**
 * PLC 명령 로그 패널 — useMonitoringData 의 events 중 PLC 관련 항목만 필터하여 표시.
 *
 * 백엔드 broadcast `plc_command` 이벤트가 도착하면 useMonitoringData 가 message 앞에
 * `[SIM]` 또는 `[HMI]` 마커를 붙여 addEvent 한다. 이 컴포넌트는 그 마커로 PLC 항목만
 * 추려 시간순(최신 위)으로 그린다.
 *
 * 사용 예 (UnifiedDashboard 내부):
 *   const { events } = useMonitoringData()
 *   <PlcEventLogPanel events={events} />
 */
export function PlcEventLogPanel({ events, maxItems = 30 }: Props) {
  const plcEvents = events.filter(
    (e) => e.message.startsWith('[SIM]') || e.message.startsWith('[HMI]'),
  );

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex justify-between items-center px-3 py-2 border-b border-[var(--border-secondary)] bg-[var(--bg-surface-alt)] shrink-0">
        <h3 className="text-xs font-semibold text-[var(--text-primary)] tracking-tight uppercase">
          PLC 명령 로그
        </h3>
        <span className="text-[10px] font-medium text-[var(--text-tertiary)] tabular-nums">
          {plcEvents.length} 건
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 text-[11px] font-mono leading-relaxed">
        {plcEvents.length === 0 ? (
          <div className="text-[var(--text-tertiary)] py-2 text-center">아직 명령 발행 없음</div>
        ) : (
          plcEvents
            .slice(-maxItems)
            .reverse()
            .map((e, i) => (
              <div
                key={i}
                className={
                  e.type === 'error'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[var(--text-secondary)]'
                }
              >
                <span className="text-[var(--text-tertiary)]">{e.time}</span>{' '}
                <span>{e.message}</span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
