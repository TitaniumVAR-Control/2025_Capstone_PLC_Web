import { useEffect, useState } from 'react';
import { usePlcDiag } from '../hooks/usePlcDiag';
import type { DiagDefaults, DiagRg1, LogEntry } from '../types';

// 학습 정합성 갭 — RG1 31필드 중 임시 매핑·단위 미확정 필드에 노란 배지를 띄운다.
// (plan: 작업 3 가시화)
const FIELD_NOTES: Record<string, string> = {
  lift_speed_rpm: '학습 입력 speed 는 mm/s 인데 PLC 는 RPM — 변환식 미확정',
  coolant_temp_2: 'chamber_temp 임시 매핑 (정식 신호 확정 전)',
};

export function PlcDiagPage() {
  const diag = usePlcDiag();
  return (
    <div className="min-h-screen p-4 bg-[var(--bg-base)] text-[var(--text-primary)]">
      <header className="mb-4 flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
        <div>
          <h1 className="text-xl font-semibold">PLC 진단 테스트</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            실 적용 전 단위 명령으로 HMI/PLC 동작을 확인합니다. 운전 화면과는 분리된 채널입니다.
          </p>
        </div>
        <ConnectionBar diag={diag} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <CommandGrid diag={diag} />
        </div>
        <div className="space-y-4">
          <Rg1Panel rg1={diag.rg1} onRefresh={diag.refreshRg1} disabled={diag.busy || !diag.connection.connected} />
          <LogPanel logs={diag.logs} />
        </div>
      </div>
    </div>
  );
}

// ── 상단 연결 바 ─────────────────────────────────

function ConnectionBar({ diag }: { diag: ReturnType<typeof usePlcDiag> }) {
  const { connection, busy, connect, disconnect } = diag;
  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${connection.connected ? 'bg-green-500' : 'bg-red-500'}`}
        aria-label={connection.connected ? '연결됨' : '연결 끊김'}
      />
      <span className="text-sm tabular-nums text-[var(--text-secondary)]">
        {connection.host || '?'}:{connection.port || '?'}
      </span>
      {connection.connected ? (
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50"
          onClick={disconnect}
          disabled={busy}
        >
          연결 해제
        </button>
      ) : (
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
          onClick={connect}
          disabled={busy}
        >
          HMI 접속
        </button>
      )}
    </div>
  );
}

// ── 명령 카드 그리드 ─────────────────────────────

function CommandGrid({ diag }: { diag: ReturnType<typeof usePlcDiag> }) {
  // S5(회전) 방향은 정방향(CW) 고정 — 진단 UI 에서도 RPM/지령만 노출.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PowerCard diag={diag} />
      <LiftCard diag={diag} />
      <RotationCard diag={diag} />
      <TiltCard diag={diag} />
      <FastCylinderCard diag={diag} />
      <AiControlCard diag={diag} />
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] p-4">
      <header className="mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

const inputCls =
  'w-full px-2 py-1 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-sm tabular-nums';

const sendBtnCls =
  'w-full mt-2 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-[var(--text-secondary)]">
      <span className="block mb-0.5">{label}</span>
      {children}
    </label>
  );
}

// ── S2: Power ──

function PowerCard({ diag }: { diag: ReturnType<typeof usePlcDiag> }) {
  const [on, setOn] = useState(false);
  const [svPct, setSvPct] = useState(0);
  const disabled = !diag.connection.connected || diag.busy;
  return (
    <Card title="S2 — 파워 (Power Set)" subtitle="전원 ON/OFF + SV%(0~100)">
      <div className="grid grid-cols-2 gap-2">
        <Field label="ON">
          <select className={inputCls} value={on ? '1' : '0'} onChange={e => setOn(e.target.value === '1')}>
            <option value="0">OFF</option>
            <option value="1">ON</option>
          </select>
        </Field>
        <Field label="SV %">
          <input
            type="number"
            min={0}
            max={100}
            className={inputCls}
            value={svPct}
            onChange={e => setSvPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
        </Field>
      </div>
      <button
        type="button"
        className={sendBtnCls}
        disabled={disabled}
        onClick={() => diag.sendCommand('/api/plc/diag/power', 'S2 power', { on, sv_pct: svPct })}
      >
        S2 발행
      </button>
    </Card>
  );
}

// ── S3: Lift ──

function LiftCard({ diag }: { diag: ReturnType<typeof usePlcDiag> }) {
  const d = diag.defaults;
  const [command, setCommand] = useState(1);
  const [startPos, setStartPos] = useState(0);
  const [upDist, setUpDist] = useState(0);
  const [upSpeed, setUpSpeed] = useState(0);
  const [dnDist, setDnDist] = useState(1);
  const [dnSpeed, setDnSpeed] = useState(100);

  useEffect(() => {
    if (d) {
      setStartPos(d.lift_start_position_mm);
      setUpDist(d.lift_pulse_up_dist_mm);
      setUpSpeed(d.lift_pulse_speed_rpm);
      setDnSpeed(d.lift_pulse_speed_rpm);
    }
  }, [d]);

  const disabled = !diag.connection.connected || diag.busy;
  return (
    <Card title="S3 — 잉곳 상승·하강 (Lift Servo)" subtitle="0:정지 1:시작위치 2:PULSE UP 3:PULSE DN 4:작업완료복귀">
      <div className="grid grid-cols-2 gap-2">
        <Field label="지령">
          <select className={inputCls} value={command} onChange={e => setCommand(Number(e.target.value))}>
            <option value={0}>0 — 정지</option>
            <option value={1}>1 — 시작위치 이동</option>
            <option value={2}>2 — PULSE UP (상승)</option>
            <option value={3}>3 — PULSE DN (하강)</option>
            <option value={4}>4 — 작업완료복귀 (Fast UP + 원점이동)</option>
          </select>
        </Field>
        <Field label="시작위치 mm">
          <input type="number" min={0} max={3000} className={inputCls} value={startPos} onChange={e => setStartPos(Number(e.target.value) || 0)} />
        </Field>
        <Field label="UP 거리 mm">
          <input type="number" min={0} max={3000} className={inputCls} value={upDist} onChange={e => setUpDist(Number(e.target.value) || 0)} />
        </Field>
        <Field label="UP 속도 RPM">
          <input type="number" min={0} max={3000} className={inputCls} value={upSpeed} onChange={e => setUpSpeed(Number(e.target.value) || 0)} />
        </Field>
        <Field label="DN 거리 mm">
          <input type="number" min={0} max={3000} className={inputCls} value={dnDist} onChange={e => setDnDist(Number(e.target.value) || 0)} />
        </Field>
        <Field label="DN 속도 RPM">
          <input type="number" min={0} max={3000} className={inputCls} value={dnSpeed} onChange={e => setDnSpeed(Number(e.target.value) || 0)} />
        </Field>
      </div>
      <button
        type="button"
        className={sendBtnCls}
        disabled={disabled}
        onClick={() => diag.sendCommand('/api/plc/diag/lift', `S3 cmd=${command}`, {
          command,
          start_pos_mm: startPos,
          up_dist_mm: upDist,
          up_speed_rpm: upSpeed,
          dn_dist_mm: dnDist,
          dn_speed_rpm: dnSpeed,
        })}
      >
        S3 발행
      </button>
    </Card>
  );
}

// ── S5: Rotation ──
// 방향(direction)은 정방향(CW=0)으로 백엔드에서 고정 발행. UI 에서 변경 불가.

function RotationCard({ diag }: { diag: ReturnType<typeof usePlcDiag> }) {
  const d = diag.defaults;
  const [command, setCommand] = useState(1);
  const [speed, setSpeed] = useState(100);

  useEffect(() => {
    if (d) {
      setSpeed(d.rotation_primary_rpm);
    }
  }, [d]);

  const disabled = !diag.connection.connected || diag.busy;
  return (
    <Card
      title="S5 — 회전 (Rotation)"
      subtitle="0:정지 1:회전동작 2:RPM설정 (방향은 정방향 고정)"
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="지령">
          <select className={inputCls} value={command} onChange={e => setCommand(Number(e.target.value))}>
            <option value={0}>0 — 정지</option>
            <option value={1}>1 — 회전 동작</option>
            <option value={2}>2 — RPM 설정 (동작 중 속도 조정)</option>
          </select>
        </Field>
        <Field label="RPM (0~566)">
          <input
            type="number"
            min={0}
            max={566}
            className={inputCls}
            value={speed}
            onChange={e => setSpeed(Math.max(0, Math.min(566, Number(e.target.value) || 0)))}
          />
        </Field>
      </div>
      <button
        type="button"
        className={sendBtnCls}
        disabled={disabled}
        onClick={() => diag.sendCommand('/api/plc/diag/rotation', `S5 cmd=${command}`, { command, speed_rpm: speed })}
      >
        S5 발행
      </button>
    </Card>
  );
}

// ── S4: Tilt ──

function TiltCard({ diag }: { diag: ReturnType<typeof usePlcDiag> }) {
  const d = diag.defaults;
  const [command, setCommand] = useState(1);
  const [steps, setSteps] = useState<number[][]>([[90, 600], [100, 800], [110, 1000]]);

  useEffect(() => {
    if (d && d.tilt_steps.length === 3) {
      setSteps(d.tilt_steps.map(s => [s[0], s[1]]));
    }
  }, [d]);

  const disabled = !diag.connection.connected || diag.busy;
  const setStep = (i: number, j: number, v: number) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? [j === 0 ? v : s[0], j === 1 ? v : s[1]] : s));
  };

  return (
    <Card
      title="S4 — 틸팅 (Tilt, 용탕 붓기)"
      subtitle="0:정지 1:STEP-1 2:STEP-2 3:STEP-3 4:원점복귀 (순차 운전, 용량별 시간/속도 분기는 매퍼에서)"
    >
      <Field label="지령">
        <select className={inputCls} value={command} onChange={e => setCommand(Number(e.target.value))}>
          <option value={0}>0 — 정지</option>
          <option value={1}>1 — STEP-1 운전</option>
          <option value={2}>2 — STEP-2 운전</option>
          <option value={3}>3 — STEP-3 운전</option>
          <option value={4}>4 — 원점 복귀</option>
        </select>
      </Field>
      <div className="mt-2 space-y-1">
        {steps.map((s, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <Field label={`Step${i + 1} 각도°`}>
              <input type="number" min={0} max={180} className={inputCls} value={s[0]} onChange={e => setStep(i, 0, Math.max(0, Math.min(180, Number(e.target.value) || 0)))} />
            </Field>
            <Field label={`Step${i + 1} RPM`}>
              <input type="number" min={0} max={2000} className={inputCls} value={s[1]} onChange={e => setStep(i, 1, Math.max(0, Math.min(2000, Number(e.target.value) || 0)))} />
            </Field>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={sendBtnCls}
        disabled={disabled}
        onClick={() => diag.sendCommand('/api/plc/diag/tilt', `S4 cmd=${command}`, { command, steps })}
      >
        S4 발행
      </button>
    </Card>
  );
}

// ── S1: Fast Cylinder ──

function FastCylinderCard({ diag }: { diag: ReturnType<typeof usePlcDiag> }) {
  const [action, setAction] = useState(1);
  const disabled = !diag.connection.connected || diag.busy;
  return (
    <Card title="S1 — Fast 실린더" subtitle="0:NOP 1:UP 2:DN">
      <Field label="action">
        <select className={inputCls} value={action} onChange={e => setAction(Number(e.target.value))}>
          <option value={0}>0 — NOP</option>
          <option value={1}>1 — UP</option>
          <option value={2}>2 — DN</option>
        </select>
      </Field>
      <button
        type="button"
        className={sendBtnCls}
        disabled={disabled}
        onClick={() => diag.sendCommand('/api/plc/diag/fast-cylinder', `S1 action=${action}`, { action })}
      >
        S1 발행
      </button>
    </Card>
  );
}

// ── S6: AI Control ──

function AiControlCard({ diag }: { diag: ReturnType<typeof usePlcDiag> }) {
  const [start, setStart] = useState(true);
  const disabled = !diag.connection.connected || diag.busy;
  return (
    <Card title="S6 — AI 제어 ON/OFF" subtitle="HMI 측 AI 제어 모드 토글">
      <Field label="start">
        <select className={inputCls} value={start ? '1' : '0'} onChange={e => setStart(e.target.value === '1')}>
          <option value="0">0 — 정지</option>
          <option value="1">1 — 시작</option>
        </select>
      </Field>
      <button
        type="button"
        className={sendBtnCls}
        disabled={disabled}
        onClick={() => diag.sendCommand('/api/plc/diag/ai-control', `S6 start=${start}`, { start })}
      >
        S6 발행
      </button>
    </Card>
  );
}

// ── RG1 31필드 덤프 ─────────────────────────────

function Rg1Panel({ rg1, onRefresh, disabled }: { rg1: DiagRg1 | null; onRefresh: () => void; disabled: boolean }) {
  return (
    <section className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">RG1 (G1 응답 31필드)</h2>
          <p className="text-xs text-[var(--text-secondary)]">연결 시 1초마다 자동 폴링</p>
        </div>
        <button
          type="button"
          className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-700 text-white text-xs disabled:opacity-50"
          onClick={onRefresh}
          disabled={disabled}
        >
          G1 재요청
        </button>
      </header>
      {rg1?.error && (
        <p className="text-xs text-red-500 mb-2">{rg1.error}</p>
      )}
      {!rg1?.parsed ? (
        <p className="text-xs text-[var(--text-secondary)]">아직 RG1 수신 없음</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs tabular-nums">
            <tbody>
              {Object.entries(rg1.parsed).map(([k, v]) => (
                <tr key={k} className="border-b border-[var(--border-secondary)]">
                  <td className="py-1 pr-2 text-[var(--text-secondary)] whitespace-nowrap">
                    {k}
                    {FIELD_NOTES[k] && (
                      <span
                        title={FIELD_NOTES[k]}
                        className="ml-1 inline-block px-1 py-0.5 rounded bg-yellow-200 text-yellow-900 text-[10px] align-middle"
                      >
                        ⚠ 임시
                      </span>
                    )}
                  </td>
                  <td className="py-1 text-right text-[var(--text-primary)]">{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── 응답 로그 ─────────────────────────────────

function LogPanel({ logs }: { logs: LogEntry[] }) {
  const color = (lv: LogEntry['level']) => {
    switch (lv) {
      case 'ok': return 'text-green-600 dark:text-green-400';
      case 'warn': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-[var(--text-secondary)]';
    }
  };
  return (
    <section className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] p-4">
      <header className="mb-3">
        <h2 className="text-base font-semibold">응답 로그</h2>
        <p className="text-xs text-[var(--text-secondary)]">최근 명령·응답 (최대 100건)</p>
      </header>
      {logs.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">로그 없음</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto space-y-1 text-xs">
          {logs.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[var(--text-tertiary)] tabular-nums">{e.ts}</span>
              <span className="font-medium w-20 shrink-0">{e.label}</span>
              <span className={`flex-1 ${color(e.level)}`}>{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// (defaults 는 자식 컴포넌트들이 직접 hook 으로 받으므로 별도 노출 X)
export type { DiagDefaults };
