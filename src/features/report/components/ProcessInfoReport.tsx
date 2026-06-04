import type { ReportAutoData, ReportFormData, StatValues } from '../types';
import { PENDING } from '../types';

interface Props {
  auto: ReportAutoData;
  form: ReportFormData;
  onField: <K extends keyof ReportFormData>(key: K, value: ReportFormData[K]) => void;
  onPhoto: (index: number, file: File | null) => void;
}

const BASE   = 'border border-slate-300 dark:border-slate-700 text-xs print:border-slate-300';
const LABEL  = `${BASE} bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 px-2 py-1.5 whitespace-nowrap print:bg-slate-100 print:text-slate-700`;
const AUTO   = `${BASE} bg-blue-50 dark:bg-blue-950/40 text-slate-700 dark:text-slate-200 px-2 py-1.5 text-center tabular-nums print:bg-blue-50 print:text-slate-700`;
const PEND   = `${BASE} bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 px-2 py-1.5 text-center print:bg-slate-50 print:text-slate-400`;
const YELLOW = `${BASE} bg-yellow-50 dark:bg-yellow-950/30 px-1 py-1 print:bg-yellow-50`;
const GAP    = 'border-0 bg-transparent p-0';

function AC({ v, cls = '' }: { v: string; cls?: string }) {
  const pending = v === PENDING;
  return (
    <td className={`${pending ? PEND : AUTO} ${cls}`}
        title={pending ? '서버 연동 후 자동 입력' : undefined}>
      {v}
    </td>
  );
}

function UI({ v, onChange, ph = '' }: { v: string; onChange: (s: string) => void; ph?: string }) {
  return (
    <td className={YELLOW}>
      <input type="text" value={v} placeholder={ph}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 text-xs print:text-slate-800 print:placeholder-slate-400" />
    </td>
  );
}

function StatCols({ v }: { v: StatValues }) {
  return <><AC v={v.avg} /><AC v={v.std} /><AC v={v.max} /><AC v={v.min} /></>;
}

const STAT_HDRS = ['평균', '편차', '최대', '최소'];

const SNAPSHOT_SLOTS = [
  { key: 'snapshotArc'      as const, label: '스냅샷\n아크'    },
  { key: 'snapshotMelt'     as const, label: '스냅샷\n용해'    },
  { key: 'snapshotTilting1' as const, label: '스냅샷\n1차틸팅' },
  { key: 'snapshotTilting2' as const, label: '스냅샷\n2차틸팅' },
  { key: 'snapshotTilting3' as const, label: '스냅샷\n3차틸팅' },
  { key: 'snapshotRpm'      as const, label: '스냅샷\nRPM'     },
];

export function ProcessInfoReport({ auto, form, onField, onPhoto }: Props) {
  const skullDiff = (() => {
    const b = parseFloat(form.skullBefore), a = parseFloat(form.skullAfter);
    if (isNaN(b) || isNaN(a)) return PENDING;
    return (a - b).toFixed(2);
  })();

  const castingTotal = (() => {
    const vals = [form.casting1, form.casting2, form.casting3, form.casting4,
                  form.sprue, form.tundish].map(Number).filter(v => !isNaN(v) && v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0).toFixed(2) : PENDING;
  })();

  const castingDiff = (() => {
    const raw = auto.theoreticalMeltRaw, w = parseFloat(castingTotal);
    if (!raw || isNaN(w)) return PENDING;
    return (raw - w).toFixed(2);
  })();

  return (
    <div className="bg-white dark:bg-[var(--bg-base)] text-slate-900 dark:text-slate-100 p-6 space-y-3 text-xs print:p-4 print:bg-white print:text-slate-900">

      {/* ━━ ROW 1. 식별 정보 — 8열 (라벨|값|gap|라벨|값|gap|라벨|값) ━━━━━━━━━━━ */}
      {/* 각 그룹이 ~1/3, 그룹 사이 gap 열로 시각적 분리 */}
      <table className="w-full border-collapse table-fixed print-row-avoid">
        <colgroup>
          <col style={{ width: '7%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '3%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '3%' }} />
          <col style={{ width: '7%' }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td className={LABEL}>작업일자</td>
            <td className={AUTO} style={{ textAlign: 'left' }}>{auto.workDate}</td>
            <td className={GAP} />
            <td className={LABEL}>Log.data</td>
            <td className={AUTO} style={{ textAlign: 'left' }}>{auto.logData}</td>
            <td className={GAP} colSpan={3} />
          </tr>
          <tr><td colSpan={8} className="h-2 border-0 bg-transparent p-0" /></tr>
          <tr>
            <td className={LABEL}>고객사</td>
            <UI v={form.customerId} onChange={v => onField('customerId', v)} />
            <td className={GAP} />
            <td className={LABEL}>R/S No.</td>
            <UI v={form.rsNo} onChange={v => onField('rsNo', v)} />
            <td className={GAP} />
            <td className={LABEL}>Heat No.</td>
            <UI v={form.heatNo} onChange={v => onField('heatNo', v)} />
          </tr>
          <tr>
            <td className={LABEL}>부품번호</td>
            <UI v={form.partNo} onChange={v => onField('partNo', v)} />
            <td className={GAP} />
            <td className={LABEL}>품 명</td>
            <UI v={form.productName} onChange={v => onField('productName', v)} />
            <td className={GAP} />
            <td className={LABEL}>잉곳사양</td>
            <td className={YELLOW}>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[10px] shrink-0">Ø</span>
                <input type="text" value={form.ingotDiameter} placeholder="지름"
                  onChange={e => onField('ingotDiameter', e.target.value)}
                  className="w-0 flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 text-xs print:text-slate-800 print:placeholder-slate-400" />
                <span className="text-slate-300 shrink-0">|</span>
                <span className="text-slate-500 text-[10px] shrink-0">L</span>
                <input type="text" value={form.ingotLength} placeholder="길이"
                  onChange={e => onField('ingotLength', e.target.value)}
                  className="w-0 flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 text-xs print:text-slate-800 print:placeholder-slate-400" />
              </div>
            </td>
          </tr>
          <tr>
            <td className={LABEL}>DWG No.</td>
            <UI v={form.dwgNo} onChange={v => onField('dwgNo', v)} />
            <td className={GAP} />
            <td className={LABEL}>계획기간</td>
            <UI v={form.planPeriod} onChange={v => onField('planPeriod', v)} />
            <td className={GAP} />
            <td className={LABEL}>제조사</td>
            <UI v={form.manufacturer} onChange={v => onField('manufacturer', v)} />
          </tr>
        </tbody>
      </table>

      {/* ━━ ROW 2. 공정 데이터 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* 진공도(1) | 아크+용융(2) = 왼쪽 50%  |  냉각수(2) | 용해량관리(1) = 오른쪽 50% */}
      <div className="flex gap-3 w-full items-stretch print-row-avoid">

        {/* 진공도 — flex-1 (전체의 1/6 ≈ 16.7%) */}
        <table className="border-collapse table-fixed flex-1 min-w-0 h-full">
          <colgroup>
            <col style={{ width: '45%' }} /><col />
          </colgroup>
          <thead>
            <tr><td colSpan={2} className={`${LABEL} text-center`}>진공도</td></tr>
            <tr>
              <td className={LABEL}></td>
              <td className={`${LABEL} text-center`}>Torr</td>
            </tr>
          </thead>
          <tbody>
            <tr><td className={LABEL}>초기</td>  <AC v={auto.vacuumInitTime} /></tr>
            <tr><td className={LABEL}>용해시</td><AC v={auto.vacuumMeltTime} /></tr>
            <tr><td className={LABEL}>냉각시</td><AC v={auto.vacuumCoolTime} /></tr>
          </tbody>
        </table>

        {/* 전압/전류/온도 — flex-[2] (전체의 2/6 ≈ 33.3%, 진공도와 합쳐 왼쪽 50%) */}
        <table className="border-collapse table-fixed h-full" style={{ flex: '2 2 0%', minWidth: 0 }}>
          <colgroup>
            <col style={{ width: '9%' }} />
            <col style={{ width: '11.4%' }} /><col style={{ width: '11.4%' }} />
            <col style={{ width: '11.4%' }} /><col style={{ width: '11.4%' }} />
            <col style={{ width: '11.4%' }} /><col style={{ width: '11.4%' }} />
            <col style={{ width: '11.4%' }} /><col />
          </colgroup>
          <thead>
            <tr>
              <td className={LABEL} rowSpan={2}></td>
              <td colSpan={4} className={`${LABEL} text-center`}>아크 구간</td>
              <td colSpan={4} className={`${LABEL} text-center`}>용융 구간</td>
            </tr>
            <tr>
              {[...STAT_HDRS, ...STAT_HDRS].map((h, i) => (
                <td key={i} className={`${LABEL} text-center`}>{h}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr><td className={LABEL}>전압</td><StatCols v={auto.voltageArc} /><StatCols v={auto.voltageMelt} /></tr>
            <tr><td className={LABEL}>전류</td><StatCols v={auto.currentArc} /><StatCols v={auto.currentMelt} /></tr>
            <tr><td className={LABEL}>온도</td><StatCols v={auto.tempArc}    /><StatCols v={auto.tempMelt}    /></tr>
          </tbody>
        </table>

        {/* 냉각수 — flex-[2] (전체의 2/6 ≈ 33.3%, 용해량관리와 합쳐 오른쪽 50%) */}
        <table className="border-collapse table-fixed h-full" style={{ flex: '2 2 0%', minWidth: 0 }}>
          <colgroup>
            <col style={{ width: '35%' }} />
            <col /><col /><col /><col />
          </colgroup>
          <thead>
            <tr><td colSpan={5} className={`${LABEL} text-center`}>냉각수</td></tr>
            <tr>
              <td className={LABEL}></td>
              {STAT_HDRS.map(h => <td key={h} className={`${LABEL} text-center`}>{h}</td>)}
            </tr>
          </thead>
          <tbody>
            {([
              ['챔버상부', auto.coolingChamber],
              ['GUN상부',  auto.coolingGunTop],
              ['GUN하부',  auto.coolingGunBottom],
              ['유량',     auto.coolingFlow],
            ] as [string, StatValues][]).map(([lbl, sv]) => (
              <tr key={lbl}><td className={LABEL}>{lbl}</td><StatCols v={sv} /></tr>
            ))}
          </tbody>
        </table>

        {/* 용해량 관리 — flex-1 (전체의 1/6 ≈ 16.7%) */}
        <table className="border-collapse table-fixed flex-1 min-w-0 h-full">
          <colgroup>
            <col style={{ width: '52%' }} /><col />
          </colgroup>
          <thead>
            <tr><td colSpan={2} className={`${LABEL} text-center`}>용해량 관리</td></tr>
          </thead>
          <tbody>
            <tr><td className={LABEL}>초기값</td>    <AC v={auto.initialWeight}   /></tr>
            <tr><td className={LABEL}>목표값</td>    <AC v={auto.targetWeight}    /></tr>
            <tr><td className={LABEL}>이론용해량</td><AC v={auto.theoreticalMelt} /></tr>
            <tr><td className={LABEL}>아크시간</td>  <AC v={auto.arcTime}         /></tr>
            <tr><td className={LABEL}>용해시간</td>  <AC v={auto.meltTime}        /></tr>
            <tr><td className={LABEL}>총 시간</td>   <AC v={auto.totalTime}       /></tr>
          </tbody>
        </table>
      </div>

      {/* ━━ ROW 3. 틸팅 / RPM / 용탕 주입 — 3개 flex-1 ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex gap-3 w-full items-stretch print-row-avoid">

        <table className="border-collapse table-fixed flex-1 min-w-0 h-full">
          <colgroup>
            <col style={{ width: '28%' }} /><col style={{ width: '36%' }} /><col />
          </colgroup>
          <thead>
            <tr><td colSpan={3} className={`${LABEL} text-center`}>틸팅 정보</td></tr>
            <tr>
              <td className={LABEL}></td>
              <td className={`${LABEL} text-center`}>RPM</td>
              <td className={`${LABEL} text-center`}>각도</td>
            </tr>
          </thead>
          <tbody>
            {([
              ['1차', auto.tilting1Rpm, auto.tilting1Angle],
              ['2차', auto.tilting2Rpm, auto.tilting2Angle],
              ['3차', auto.tilting3Rpm, auto.tilting3Angle],
            ] as [string, string, string][]).map(([lbl, rpm, ang]) => (
              <tr key={lbl}><td className={LABEL}>{lbl}</td><AC v={rpm} /><AC v={ang} /></tr>
            ))}
          </tbody>
        </table>

        <table className="border-collapse table-fixed flex-1 min-w-0 h-full">
          <colgroup>
            <col style={{ width: '28%' }} /><col style={{ width: '36%' }} /><col />
          </colgroup>
          <thead>
            <tr><td colSpan={3} className={`${LABEL} text-center`}>RPM 정보</td></tr>
            <tr>
              <td className={LABEL}></td>
              <td className={`${LABEL} text-center`}>RPM</td>
              <td className={`${LABEL} text-center`}>시간</td>
            </tr>
          </thead>
          <tbody>
            {([
              ['1차',  auto.rpm1,    auto.rpmTime1   ],
              ['2차',  auto.rpm2,    auto.rpmTime2   ],
              ['유지', auto.rpmHold, auto.rpmHoldTime],
            ] as [string, string, string][]).map(([lbl, rpm, t]) => (
              <tr key={lbl}><td className={LABEL}>{lbl}</td><AC v={rpm} /><AC v={t} /></tr>
            ))}
          </tbody>
        </table>

        <table className="border-collapse table-fixed flex-1 min-w-0 h-full">
          <colgroup>
            <col style={{ width: '50%' }} /><col />
          </colgroup>
          <thead>
            <tr><td colSpan={2} className={`${LABEL} text-center`}>용탕 주입 정보</td></tr>
            <tr>
              <td className={`${LABEL} text-center`}>주입시간</td>
              <td className={`${LABEL} text-center`}>주입속도</td>
            </tr>
          </thead>
          <tbody>
            <tr><AC v={auto.pourTime} /><AC v={auto.pourSpeed} /></tr>
          </tbody>
        </table>
      </div>

      {/* ━━ ROW 4. SKULL / 주조품 관리 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SKULL(flex-1) | 주조품관리(flex-[2]) */}
      <div className="flex gap-3 w-full items-stretch print-row-avoid">

        {/* SKULL 관리 — flex-1 */}
        <table className="border-collapse table-fixed flex-1 min-w-0 h-full">
          <colgroup>
            <col style={{ width: '45%' }} /><col />
          </colgroup>
          <thead>
            <tr><td colSpan={2} className={`${LABEL} text-center`}>SKULL 관리</td></tr>
          </thead>
          <tbody>
            <tr>
              <td className={LABEL}>주조전</td>
              <UI v={form.skullBefore} onChange={v => onField('skullBefore', v)} ph="kg" />
            </tr>
            <tr>
              <td className={LABEL}>주조후</td>
              <UI v={form.skullAfter} onChange={v => onField('skullAfter', v)} ph="kg" />
            </tr>
            <tr><td className={LABEL}>증감</td><AC v={skullDiff} /></tr>
          </tbody>
        </table>

        {/* 주조품 관리 — flex-[2] */}
        <table className="border-collapse table-fixed h-full" style={{ flex: '2 2 0%', minWidth: 0 }}>
          <colgroup>
            <col style={{ width: '15%' }} /><col style={{ width: '35%' }} />
            <col style={{ width: '15%' }} /><col />
          </colgroup>
          <thead>
            <tr><td colSpan={4} className={`${LABEL} text-center`}>주조품 관리</td></tr>
          </thead>
          <tbody>
            <tr>
              <td className={LABEL}>주조품1</td>
              <UI v={form.casting1} onChange={v => onField('casting1', v)} />
              <td className={LABEL}>주조품2</td>
              <UI v={form.casting2} onChange={v => onField('casting2', v)} />
            </tr>
            <tr>
              <td className={LABEL}>탕구</td>
              <UI v={form.sprue} onChange={v => onField('sprue', v)} />
              <td className={LABEL}>주조품3</td>
              <UI v={form.casting3} onChange={v => onField('casting3', v)} />
            </tr>
            <tr>
              <td className={LABEL}>턴디쉬</td>
              <UI v={form.tundish} onChange={v => onField('tundish', v)} />
              <td className={LABEL}>주조품4</td>
              <UI v={form.casting4} onChange={v => onField('casting4', v)} />
            </tr>
            <tr>
              <td className={LABEL}>중량</td>
              <AC v={castingTotal} />
              <td className={LABEL}>증감</td>
              <AC v={castingDiff} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ━━ ROW 5. 주조 공정 사진 — 풀 너비 분리 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex flex-col gap-2 print-photo-section">
        <div className={`${LABEL} text-center`}>주조 공정 사진</div>

        {/* 자동 스냅샷 6장 */}
        <div className="grid grid-cols-6 gap-2 print-grid-avoid">
          {SNAPSHOT_SLOTS.map(({ key, label }) => {
            const src = auto[key];
            return (
              <div key={key}
                className="aspect-video print:aspect-square border border-blue-300 dark:border-blue-800 rounded bg-blue-50 dark:bg-blue-950/40 print:bg-blue-50 print:border-blue-300
                           flex items-center justify-center overflow-hidden"
                title={label.replace('\n', ' ')}
              >
                {src
                  ? <img src={src} alt={label} className="w-full h-full object-cover" />
                  : <span className="text-blue-400 dark:text-blue-300 text-[10px] text-center whitespace-pre-line leading-tight px-1 print:text-blue-400">{label}</span>
                }
              </div>
            );
          })}
        </div>

        {/* 수동 업로드 5장 */}
        <div className="grid grid-cols-5 gap-2 print-grid-avoid">
          {form.photos.map((src, i) => (
            <label key={i}
              className="aspect-video print:aspect-square border-2 border-dashed border-slate-300 dark:border-slate-700 rounded cursor-pointer
                         hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-500 dark:hover:bg-blue-950/40 transition-colors
                         flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 print:bg-slate-50 print:border-slate-300 relative"
              title="클릭하여 사진 업로드"
            >
              {src ? (
                <>
                  <img src={src} alt={`공정사진 ${i + 1}`} className="w-full h-full object-cover" />
                  <button type="button"
                    onClick={e => { e.preventDefault(); onPhoto(i, null); }}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full
                               w-4 h-4 text-xs flex items-center justify-center hover:bg-red-600"
                  >×</button>
                </>
              ) : (
                <span className="text-slate-400 text-xl">+</span>
              )}
              <input type="file" accept="image/*" className="sr-only"
                onChange={e => onPhoto(i, e.target.files?.[0] ?? null)} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
