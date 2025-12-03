import { useMonitoringData } from '../hooks/useMonitoringData';
import { MonitoringChart } from './MonitoringChart';
import { CameraPlaceholder } from './CameraPlaceholder';
import { DataDisplay } from './DataDisplay';

/**
 * 메인 대시보드 컴포넌트
 * - 상단: 카메라 영역
 * - 중단: 3개 차트 (전류, 진공도, 하강속도)
 * - 하단: 현재 수치 표시
 */
export function Dashboard() {
  const { state, currentIndex, totalCount } = useMonitoringData();

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">오류 발생</h2>
          <p className="text-gray-600 mb-4">{state.message}</p>
          <p className="text-sm text-gray-500">
            CSV 파일이 public/data/ 폴더에 있는지 확인해주세요.
          </p>
        </div>
      </div>
    );
  }

  const { data } = state;
  const latestData = data[data.length - 1] || null;

  // 차트용 데이터 변환
  const currentChartData = data.map(d => ({ timestamp: d.timestamp, value: d.current }));
  const vacuumChartData = data.map(d => ({ timestamp: d.timestamp, value: d.vacuum }));
  const speedChartData = data.map(d => ({ timestamp: d.timestamp, value: d.descentSpeed }));

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              VAR 공정 모니터링
            </h1>
            <div className="text-sm text-gray-500">
              데이터: {currentIndex + 1} / {totalCount}
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* 상단: 카메라 영역 */}
        <section>
          <CameraPlaceholder />
        </section>

        {/* 중단: 3개 차트 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MonitoringChart
            data={currentChartData}
            title="전류"
            unit="A"
            color="#3b82f6"
          />
          <MonitoringChart
            data={vacuumChartData}
            title="진공도"
            unit="Torr"
            color="#22c55e"
          />
          <MonitoringChart
            data={speedChartData}
            title="하강속도"
            unit="mm/s"
            color="#ef4444"
          />
        </section>

        {/* 하단: 현재 수치 */}
        <section>
          <DataDisplay data={latestData} />
        </section>
      </main>

      {/* 푸터 */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          VAR Process Monitoring Dashboard
        </div>
      </footer>
    </div>
  );
}
