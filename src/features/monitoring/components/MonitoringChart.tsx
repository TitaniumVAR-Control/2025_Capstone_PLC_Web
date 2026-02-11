import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MonitoringChartProps {
  data: Array<{ timestamp: string; value: number }>;
  title: string;
  unit: string;
  color: string;
  dataKey?: string;
}

/**
 * 모니터링 차트 컴포넌트
 * Recharts AreaChart with gradient fill (dark theme)
 */
export function MonitoringChart({
  data,
  title,
  unit,
  color,
}: MonitoringChartProps) {
  const gradientId = `gradient-${title}`;

  const formattedData = data.map(item => ({
    ...item,
    time: formatTime(item.timestamp),
  }));

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 h-full">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
        {data.length > 0 && (
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color }}
          >
            {data[data.length - 1].value.toFixed(2)}
            <span className="text-sm font-medium text-slate-400 ml-1">{unit}</span>
          </span>
        )}
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(51,65,85,0.3)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#64748b' }}
              stroke="#334155"
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              stroke="#334155"
              domain={['auto', 'auto']}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15,23,42,0.95)',
                border: '1px solid rgba(51,65,85,0.5)',
                borderRadius: '12px',
                color: '#e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
              itemStyle={{ color: '#e2e8f0' }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              formatter={(value: number) => [`${value.toFixed(2)} ${unit}`, title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: '#0f172a' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}
