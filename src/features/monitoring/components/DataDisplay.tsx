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
      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-gray-500 text-center">데이터 로딩 중...</p>
      </div>
    );
  }

  const items = [
    { label: '전압', value: data.voltage, unit: 'V', color: 'text-yellow-600' },
    { label: '전류', value: data.current, unit: 'A', color: 'text-blue-600' },
    { label: '진공도', value: data.vacuum, unit: 'Torr', color: 'text-green-600' },
    { label: '높이', value: data.height, unit: 'mm', color: 'text-purple-600' },
    { label: '하강속도', value: data.descentSpeed, unit: 'mm/s', color: 'text-red-600' },
    { label: '경과시간', value: data.elapsedTime, unit: '초', color: 'text-gray-600' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">현재 수치</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {items.map(item => (
          <div key={item.label} className="text-center">
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>
              {typeof item.value === 'number' ? item.value.toFixed(2) : item.value}
            </p>
            <p className="text-xs text-gray-400">{item.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
