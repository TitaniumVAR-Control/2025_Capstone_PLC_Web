import type { VarProcessData } from '../types';

interface DataDisplayProps {
  data: VarProcessData | null;
}

/**
 * 현재 수치 표시 컴포넌트
 */
export function DataDisplay({ data }: DataDisplayProps) {
  if (!data) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <p className="text-slate-500 text-center">데이터 로딩 중...</p>
      </div>
    );
  }

  const items = [
    { label: '전압', value: data.voltage, unit: 'V', color: 'text-yellow-400', borderColor: 'border-yellow-400/50', bgGlow: 'bg-yellow-400/5' },
    { label: '전류', value: data.current, unit: 'A', color: 'text-blue-400', borderColor: 'border-blue-400/50', bgGlow: 'bg-blue-400/5' },
    { label: '진공도', value: data.vacuum, unit: 'Torr', color: 'text-green-400', borderColor: 'border-green-400/50', bgGlow: 'bg-green-400/5' },
    { label: '높이', value: data.height, unit: 'mm', color: 'text-violet-400', borderColor: 'border-violet-400/50', bgGlow: 'bg-violet-400/5' },
    { label: '하강속도', value: data.descentSpeed, unit: 'mm/s', color: 'text-red-400', borderColor: 'border-red-400/50', bgGlow: 'bg-red-400/5' },
    { label: '경과시간', value: data.elapsedTime, unit: '초', color: 'text-slate-300', borderColor: 'border-slate-400/50', bgGlow: 'bg-slate-400/5' },
  ];

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-200 mb-5">현재 수치</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {items.map(item => (
          <div
            key={item.label}
            className={`${item.bgGlow} border-t-2 ${item.borderColor} rounded-lg p-4 text-center`}
          >
            <p className="text-sm text-slate-400 font-medium">{item.label}</p>
            <p className={`text-2xl lg:text-3xl font-bold tabular-nums mt-1 ${item.color}`}>
              {typeof item.value === 'number' ? item.value.toFixed(2) : item.value}
            </p>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
              {item.unit}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
