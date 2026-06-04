import { UnifiedDashboard } from './features/monitoring/components/UnifiedDashboard';

// PLC 진단은 UnifiedDashboard 의 'plc-test' 탭으로 통합됨 (?mode=plc-test 라우팅 제거).
function App() {
  return <UnifiedDashboard />;
}

export default App;
