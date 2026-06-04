import { useId, useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface MonitoringChartProps {
  data: Array<{ elapsedTime: number; value: number }>;
  title: string;
  unit: string;
  color: string;
  /** 시간 단위 목표 라인 (예: 목표 전류 프로파일). 같은 elapsedTime 축으로 정렬. */
  overlayData?: Array<{ elapsedTime: number; value: number }>;
  overlayLabel?: string;
  overlayColor?: string;
  /** 헤더 값 옆에 작게 표시할 보조 정보 (예: "24펄스/min"). */
  extraInfo?: string;
}

export function MonitoringChart({ data, title, unit, color, overlayData, overlayLabel, overlayColor, extraInfo }: MonitoringChartProps) {
  const gradientSeed = useId();
  const gradientId = `chart-gradient-${gradientSeed.replace(/:/g, '')}`;
  const latestElapsed = data[data.length - 1]?.elapsedTime ?? 0;
  const windowSize = 120;
  const xMin = latestElapsed <= windowSize ? 0 : latestElapsed - windowSize;
  const xMax = latestElapsed <= windowSize ? windowSize : latestElapsed;
  const isDark = document.documentElement.classList.contains('dark');
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const tickColor = isDark ? '#64748b' : '#94a3b8';
  const axisColor = isDark ? '#475569' : '#cbd5e1';
  const overlayCol = overlayColor ?? '#ef4444';

  // 실측 + 목표를 같은 elapsedTime 키로 병합 (ComposedChart는 single data 배열 사용)
  const merged = useMemo(() => {
    if (!overlayData || overlayData.length === 0) {
      return data.map(d => ({ elapsedTime: d.elapsedTime, value: d.value }));
    }
    const targetMap = new Map(overlayData.map(d => [d.elapsedTime, d.value]));
    return data.map(d => ({
      elapsedTime: d.elapsedTime,
      value: d.value,
      target: targetMap.get(d.elapsedTime) ?? null,
    }));
  }, [data, overlayData]);

  if (data.length === 0) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-primary)] shadow-sm overflow-hidden flex flex-col h-full">
        <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border-secondary)] bg-[var(--bg-surface-alt)] shrink-0">
          <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">{title}</h3>
          <span className="text-sm font-medium text-[var(--text-tertiary)]">대기중</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
          데이터 수신 전
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-primary)] shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border-secondary)] bg-[var(--bg-surface-alt)] shrink-0">
        <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">{title}</h3>
        {data.length > 0 && (
          <span className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums" style={{ color }}>
              {(() => {
                // 전압/전류/외란 정수, 진공도 4자리, 그 외 2자리
                const v = data[data.length - 1].value;
                const intUnits = ['V', 'A', '°C', 'L/min'];
                if (intUnits.includes(unit)) return Math.round(v).toString();
                if (unit === 'Torr') return v.toFixed(4);
                return v.toFixed(2);
              })()}
              <span className="text-sm font-medium text-[var(--text-tertiary)] ml-1">{unit}</span>
            </span>
            {extraInfo && (
              <span className="text-xs font-medium text-[var(--text-tertiary)]">{extraInfo}</span>
            )}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={merged} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={isDark ? 0.25 : 0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} strokeWidth={0.5} />
            <XAxis
              type="number" dataKey="elapsedTime" domain={[xMin, xMax]}
              tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor}
              tickLine={false} axisLine={{ stroke: axisColor }}
              tickFormatter={(value: number) => `${Math.round(value)}s`}
            />
            <YAxis
              tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor}
              domain={['auto', 'auto']} tickLine={false} axisLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? 'rgba(30,41,59,0.97)' : 'rgba(255,255,255,0.97)',
                border: `1px solid ${gridColor}`,
                borderRadius: '8px',
                color: isDark ? '#f1f5f9' : '#1e293b',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                fontSize: '12px',
              }}
              labelStyle={{ color: tickColor, marginBottom: '2px' }}
              labelFormatter={(value) => `${Math.round(Number(value))}s`}
              formatter={(value, name) => [`${Number(value ?? 0).toFixed(2)} ${unit}`, String(name)]}
            />
            {overlayData && overlayData.length > 0 && (
              <Legend verticalAlign="top" height={20} iconType="line" wrapperStyle={{ fontSize: 11 }} />
            )}
            <Area
              type="monotone" dataKey="value" name={title} stroke={color} strokeWidth={1.5}
              fill={`url(#${gradientId})`} fillOpacity={1} dot={false}
              activeDot={{ r: 3, stroke: color, strokeWidth: 1.5, fill: isDark ? '#1e293b' : '#fff' }}
              isAnimationActive={false}
            />
            {overlayData && overlayData.length > 0 && (
              <Line
                type="monotone" dataKey="target" name={overlayLabel ?? '목표'} stroke={overlayCol}
                strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
