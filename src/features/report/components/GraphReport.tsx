import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useId } from 'react';
import type { VarProcessData } from '../../monitoring/types';

interface Props {
  data: VarProcessData[];
}

interface ChartConfig {
  title: string;
  series: { key: keyof VarProcessData; label: string; color: string; unit: string; axis?: 'left' | 'right' }[];
  pending?: boolean;
}

const CHARTS: ChartConfig[] = [
  {
    title: '진공도 그래프',
    series: [{ key: 'vacuum', label: '진공도', color: '#6366f1', unit: 'Torr' }],
  },
  {
    title: '전압/전류 그래프',
    series: [
      { key: 'voltage', label: '전압', color: '#f59e0b', unit: 'V', axis: 'right' },
      { key: 'current', label: '전류', color: '#3b82f6', unit: 'A', axis: 'left' },
    ],
  },
  {
    title: 'Heat 용해 그래프',
    series: [{ key: 'cumulativeDescent', label: '누적하강량', color: '#10b981', unit: 'mm' }],
  },
  {
    title: '챔버 온도 그래프',
    series: [{ key: 'chamberTemp', label: '챔버 온도', color: '#d97706', unit: '°C' }],
  },
  {
    title: '냉각수 온도 그래프',
    series: [{ key: 'coolantTemp', label: '냉각수 온도', color: '#0891b2', unit: '°C' }],
  },
  {
    title: '유량 그래프',
    series: [{ key: 'flow', label: '유량', color: '#0d9488', unit: 'L/min' }],
  },
];

// 2행 3열 그리드: A4 가로 ≈1047×718px(여백 10mm 기준) ÷ 3열 / 2행 채우기 위한 픽셀값.
// 한 셀 폭 ≈ 340px / 차트 영역 높이 ≈ (718 − 헤더 50 − gap 8) / 2 ≈ 330px.
const PRINT_CHART_W = 340;
const PRINT_CHART_H = 290;

function buildXTicks(totalTime: number): number[] {
  if (totalTime <= 0) return [0];
  return Array.from({ length: 5 }, (_, i) => Math.round((totalTime * i) / 4));
}

function SingleChart({ config, data }: { config: ChartConfig; data: VarProcessData[] }) {
  const id = useId().replace(/:/g, '');
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const tickColor = isDark ? '#64748b' : '#94a3b8';
  const axisColor = isDark ? '#475569' : '#cbd5e1';

  if (config.pending || data.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 print:bg-white print:border-slate-200 flex flex-col h-full min-h-[170px] print:h-[320px] print:min-h-0 print-graph-card">
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 print:bg-slate-50 print:text-slate-700 print:border-slate-200">
          {config.title}
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
          {config.pending ? '서버 연동 후 데이터 표시' : '데이터 없음'}
        </div>
      </div>
    );
  }

  const chartData = data.map(d => {
    const point: Record<string, number | null> = { t: d.elapsedTime };
    for (const s of config.series) {
      const val = d[s.key];
      point[s.key as string] = typeof val === 'number' ? val : null;
    }
    return point;
  });

  const totalTime = data[data.length - 1]?.elapsedTime ?? 0;
  const xTicks = buildXTicks(totalTime);
  const hasRightAxis = config.series.some(s => s.axis === 'right');
  const leftSeries = config.series.find(s => (s.axis ?? 'left') === 'left');
  const rightSeries = config.series.find(s => s.axis === 'right');
  const leftAxisColor = leftSeries?.color ?? '#94a3b8';
  const rightAxisColor = rightSeries?.color ?? '#94a3b8';
  const margin = { top: 6, right: hasRightAxis ? 8 : 12, left: 0, bottom: 0 };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 print:bg-white print:border-slate-200 flex flex-col h-full min-h-[170px] print:h-[320px] print:min-h-0 print-graph-card">
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex justify-between print:bg-slate-50 print:text-slate-700 print:border-slate-200">
        <span>{config.title}</span>
        <span className="text-slate-400 dark:text-slate-500 font-normal">총 {Math.round(totalTime)}s</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* 화면용: ResponsiveContainer로 부모 폭에 자동 맞춤 */}
        <div className="w-full h-full print:hidden">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={margin}>
              <defs>
                {config.series.map((s, i) => (
                  <linearGradient key={i} id={`${id}-s-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke={gridColor} strokeWidth={0.5} />
              <XAxis
                type="number" dataKey="t" domain={[0, totalTime]} ticks={xTicks} interval={0}
                tick={{ fontSize: 9, fill: tickColor }} stroke={axisColor}
                tickLine={false} tickFormatter={(v: number) => `${Math.round(v)}s`}
              />
              <YAxis
                yAxisId="left" orientation="left"
                tick={{ fontSize: 9, fill: hasRightAxis ? leftAxisColor : tickColor }} stroke={axisColor}
                tickLine={false} axisLine={false} width={45} domain={['auto', 'auto']}
              />
              {hasRightAxis && (
                <YAxis
                  yAxisId="right" orientation="right"
                  tick={{ fontSize: 9, fill: rightAxisColor }} stroke={axisColor}
                  tickLine={false} axisLine={false} width={45} domain={['auto', 'auto']}
                />
              )}
              <Tooltip
                contentStyle={{
                  fontSize: 11, border: `1px solid ${gridColor}`, borderRadius: 6,
                  backgroundColor: isDark ? 'rgba(30,41,59,0.97)' : 'rgba(255,255,255,0.97)',
                  color: isDark ? '#f1f5f9' : '#1e293b',
                }}
                labelFormatter={(v) => `${Math.round(Number(v))}s`}
              />
              {config.series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {config.series.map((s, i) => (
                <Area
                  key={s.key as string}
                  yAxisId={s.axis ?? 'left'}
                  type="monotone"
                  dataKey={s.key as string}
                  name={`${s.label} (${s.unit})`}
                  stroke={s.color}
                  strokeWidth={1.5}
                  fill={`url(#${id}-s-${i})`}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 인쇄용: CSS @media print로만 토글, JS state 없음.
           명시적 픽셀로 그려 PDF 측정/타이밍 이슈 회피. */}
        <div className="hidden print:block">
          <AreaChart width={PRINT_CHART_W} height={PRINT_CHART_H} data={chartData} margin={margin}>
            <defs>
              {config.series.map((s, i) => (
                <linearGradient key={i} id={`${id}-p-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeWidth={0.5} />
            <XAxis
              type="number" dataKey="t" domain={[0, totalTime]} ticks={xTicks} interval={0}
              tick={{ fontSize: 9, fill: '#94a3b8' }} stroke="#cbd5e1"
              tickLine={false} tickFormatter={(v: number) => `${Math.round(v)}s`}
            />
            <YAxis
              yAxisId="left" orientation="left"
              tick={{ fontSize: 9, fill: hasRightAxis ? leftAxisColor : '#94a3b8' }} stroke="#cbd5e1"
              tickLine={false} axisLine={false} width={45} domain={['auto', 'auto']}
            />
            {hasRightAxis && (
              <YAxis
                yAxisId="right" orientation="right"
                tick={{ fontSize: 9, fill: rightAxisColor }} stroke="#cbd5e1"
                tickLine={false} axisLine={false} width={45} domain={['auto', 'auto']}
              />
            )}
            {config.series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
            {config.series.map((s, i) => (
              <Area
                key={s.key as string}
                yAxisId={s.axis ?? 'left'}
                type="monotone"
                dataKey={s.key as string}
                name={`${s.label} (${s.unit})`}
                stroke={s.color}
                strokeWidth={1.5}
                fill={`url(#${id}-p-${i})`}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </AreaChart>
        </div>
      </div>
    </div>
  );
}

export function GraphReport({ data }: Props) {
  return (
    <div className="bg-white dark:bg-[var(--bg-base)] p-6 print:p-2 h-full flex flex-col print:block print:h-auto print:bg-white">
      <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 print:mb-2 shrink-0 print:text-slate-600 print:border-slate-200">
        VAR REPORT — 그래프
      </div>
      <div className="grid grid-cols-3 grid-rows-2 gap-3 print:gap-2 flex-1 min-h-0 print:flex-none print:min-h-0">
        {CHARTS.map(cfg => (
          <SingleChart key={cfg.title} config={cfg} data={data} />
        ))}
      </div>
    </div>
  );
}
