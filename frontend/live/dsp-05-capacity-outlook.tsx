'use client';
// DSP-05 Capacity outlook, live. Markup and classes from the generated design (frontend/screens/dsp-05-capacity-outlook.tsx).
// Data: Plans/Lodestar.CapacityOutlook(depot=…) for each depot in view (the ISO weeks from this one that the
// Calendar covers: operating days, festival, payday, forecast total and chilled m³ from the median of the depot's
// past run dates × festival_ramp, reefers available and their m³; the weeks without calendar rows; the history the
// forecast rests on, or why there is none) and the reefers in the workshop.
// Reefer trips: needed = chilled m³ ÷ m³ per reefer trip; available = reefers × trips a day × operating days
// (the planning agent's maxTripsPerVehicle from AgentRuns/Lodestar.AgentConfig, as on the plan board). Advisory only: nothing is booked or deferred here.
// Not shown, because the service has no data for them: the brand split (Fresh/Style/Tech columns), the 80% band,
// the recommended hire and the "Other options" card.
import { PlanSide } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { usePlanScope } from '@/components/live/plan-data';
import { useAgentConfig } from '@/components/live/settings-data';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { valueOf } from '@/lib/odata/client';
import { fmtDay, fmtNum, fmtRunDate, fmtTime } from '@/lib/format';
import { useQuery } from '@/lib/odata/hooks';
import type { Depot, Vehicle } from '@/lib/odata/types';
import { depotFilter } from '@/lib/workday';
import { useDepots } from '@/components/live/depots';

/** One week of the outlook, as planning's CapacityService returns it. */
export interface OutlookWeek {
  week: string;
  weekStart: string;
  operatingDays: number;
  estimatedChilledDemandM3: number;
  estimatedTotalM3: number;
  reeferVehiclesAvailable: number;
  reeferCapacityM3: number;
  hasPayday: boolean;
  festival: string | null;
}

/** What the forecast rests on (CapacityService.getCapacityOutlook). */
export interface OutlookBasis {
  historyDays: number;
  historyFrom: string | null;
  historyTo: string | null;
  minHistoryDays: number;
  medianTotalM3PerDay: number | null;
  medianChilledM3PerDay: number | null;
  /** 'model': the weeks come from the demand model (ML service, weekly m³ per depot × brand); else the median. */
  method?: 'model' | 'history-median';
}

interface DepotOutlook {
  depot: Depot;
  weeks: OutlookWeek[];
  uncoveredWeeks: string[];
  basis: OutlookBasis | null;
  reason: string | null;
}

const MINUS = '−';
const signed = (n: number) => (n < 0 ? `${MINUS}${Math.abs(n)}` : `+${n}`);
const dayMonth = (iso: string) => fmtRunDate(iso).split(' ').slice(1).join(' ');

interface Row extends OutlookWeek {
  depot: Depot;
  perTrip: number | null;
  needed: number | null;
  available: number | null;
  headroom: number | null;
}

function toRow(depot: Depot, w: OutlookWeek, tripsPerDay: number | undefined): Row {
  const perTrip = w.reeferVehiclesAvailable > 0 ? w.reeferCapacityM3 / w.reeferVehiclesAvailable : null;
  const needed = perTrip ? Math.ceil(w.estimatedChilledDemandM3 / perTrip) : null;
  const available = tripsPerDay ? w.reeferVehiclesAvailable * tripsPerDay * w.operatingDays : null;
  return { ...w, depot, perTrip, needed, available, headroom: needed === null || available === null ? null : available - needed };
}

/** A round tick step so that about three gridlines cover `max`. */
function tickStep(max: number) {
  const raw = Math.max(max, 1) / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** The usual number of operating days in a week (a shorter week gets a label). */
function usualDays(rows: OutlookWeek[]) {
  const seen = new Map<number, number>();
  rows.forEach(r => seen.set(r.operatingDays, (seen.get(r.operatingDays) ?? 0) + 1));
  return [...seen.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
}

function Headroom({ r }: { r: Row }) {
  if (r.headroom === null) return <span className="t-3">—</span>;
  if (r.headroom < 0) return <span className="m-pill m-pill--bad" style={{ height: '24px', fontSize: '12.5px' }}>{signed(r.headroom)} trips</span>;
  if (r.headroom < (r.available ?? 0) * 0.1) return <span className="m-tag m-tag--warn"><span className="dot" />{signed(r.headroom)} tight</span>;
  return <span className="m-tag m-tag--ok"><span className="dot" />{signed(r.headroom)}</span>;
}

function Signal({ w, usual }: { w: OutlookWeek; usual: number }) {
  const parts: React.ReactNode[] = [];
  if (w.festival) parts.push(<span key="f" className="fw7" style={{ color: 'var(--st-deferred-fg)' }}>{w.festival}</span>);
  if (w.hasPayday) parts.push(<span key="p" className="t-2">{w.festival ? 'payday' : 'Payday'}</span>);
  if (w.operatingDays < usual) parts.push(<span key="d" className="t-3">{w.operatingDays} op days</span>);
  if (!parts.length) return <span className="t-3">{"Usual week"}</span>;
  return <>{parts.flatMap((p, i) => (i ? [<span key={`s${i}`} className="t-3">{"·"}</span>, p] : [p]))}</>;
}

function Chart({ weeks, peakWeek, peakBad, strip }: { weeks: OutlookWeek[]; peakWeek?: string; peakBad: boolean; strip: { depot: string; rows: Row[] } | null }) {
  const { short: depotShort } = useDepots();
  const usual = usualDays(weeks);
  const step = tickStep(Math.max(...weeks.map(w => w.estimatedTotalM3), 0));
  const ticks = Math.max(1, Math.ceil(Math.max(...weeks.map(w => w.estimatedTotalM3), 0) / step));
  const scale = 102 / (ticks * step);
  const y = (v: number) => 140 - v * scale;
  // the weeks share the plot width (726 from x 50): ten weeks sit at the design's 86.3 + i × 72.6, fewer spread out
  const cx = (i: number) => 50 + (726 / Math.max(weeks.length, 1)) * (i + 0.5);
  const maxAbs = Math.max(1, ...(strip?.rows ?? []).map(r => Math.abs(r.headroom ?? 0)));
  const hs = 15.5 / maxAbs;
  const peakAt = weeks.findIndex(w => w.week === peakWeek);
  return (
    <svg width="100%" viewBox="0 0 780 258" style={{ display: 'block', height: 'auto', maxWidth: '780px' }} xmlns="http://www.w3.org/2000/svg" fontFamily="Inter, sans-serif" data-testid="outlook-chart">
      {peakAt >= 0 && <rect x={cx(peakAt) - 34.3} y="0" width="68.6" height="182" rx="8" fill="#EEF0FF" />}
      {Array.from({ length: ticks + 1 }, (_, t) => (
        <g key={t}>
          <line x1="50" y1={y(t * step)} x2="776" y2={y(t * step)} stroke="#E3E7EE" strokeWidth="1" />
          <text x="42" y={y(t * step) + 4} textAnchor="end" fontSize="12.5" fill="#7A8395" fontFamily="JetBrains Mono, monospace">{fmtNum(t * step)}</text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const chilled = Math.min(w.estimatedChilledDemandM3, w.estimatedTotalM3);
        return (
          <g key={w.week}>
            <rect x={cx(i) - 16} y={y(w.estimatedTotalM3)} width="32" height={(w.estimatedTotalM3 - chilled) * scale} fill="#C9D0DB" />
            <rect x={cx(i) - 16} y={y(chilled)} width="32" height={chilled * scale} fill="#0E7490" />
            <text x={cx(i)} y="137.0" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#FFFFFF" fontFamily="JetBrains Mono, monospace">{fmtNum(chilled)}</text>
          </g>
        );
      })}
      <polyline points={weeks.map((w, i) => `${cx(i).toFixed(1)},${y(w.estimatedTotalM3).toFixed(1)}`).join(' ')} fill="none" stroke="#3B4CCA" strokeWidth="1.5" strokeDasharray="3 3" />
      {weeks.map((w, i) => <circle key={w.week} cx={cx(i)} cy={y(w.estimatedTotalM3)} r="2.5" fill="#3B4CCA" />)}
      {weeks.map((w, i) => (
        <g key={`l${w.week}`}>
          {w.festival && <text x={cx(i)} y="14" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#B45309">{w.festival}</text>}
          {w.hasPayday
            ? <text x={cx(i)} y="30" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#3B4CCA">{"Payday"}</text>
            : w.operatingDays < usual && <text x={cx(i)} y="30" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#7A8395">{w.operatingDays} op days</text>}
          <text x={cx(i)} y="157" textAnchor="middle" fontSize="12.5" fontWeight="800" fill={i === peakAt && peakBad ? '#B42318' : '#0F1422'} fontFamily="JetBrains Mono, monospace">{w.week}</text>
          <text x={cx(i)} y="173" textAnchor="middle" fontSize="12.5" fill="#7A8395">{dayMonth(w.weekStart)}</text>
        </g>
      ))}
      {strip && (
        <>
          <text x="50" y="198" fontSize="12.5" fontWeight="700" fill="#4A5467">{depotShort(strip.depot)} reefer trip headroom (available minus needed)</text>
          <line x1="50" y1="236" x2="776" y2="236" stroke="#4A5467" strokeWidth="1" />
          <text x="42" y="240" textAnchor="end" fontSize="12.5" fill="#7A8395" fontFamily="JetBrains Mono, monospace">{"0"}</text>
          {strip.rows.map((r, i) => {
            if (r.headroom === null) return null;
            const h = Math.max(2, Math.abs(r.headroom) * hs);
            return r.headroom < 0 ? (
              <g key={r.week}>
                <rect x={cx(i) - 16} y="236" width="32" height={h} rx="2" fill="#B42318" />
                <text x={cx(i)} y="257.0" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#B42318" fontFamily="JetBrains Mono, monospace">{signed(r.headroom)} trips</text>
              </g>
            ) : (
              <g key={r.week}>
                <rect x={cx(i) - 16} y={236 - h} width="32" height={h} rx="2" fill="#A9E3C8" />
                <text x={cx(i)} y={(236 - h - 5).toFixed(1)} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#047857" fontFamily="JetBrains Mono, monospace">{signed(r.headroom)}</text>
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
}

export default function LiveDsp05CapacityOutlook() {
  const { short: depotShort } = useDepots();
  const { depot, depots, active, setDepot } = usePlanScope();
  const key = active.join(',');
  const outlook = useQuery<DepotOutlook[]>(key ? `capacity-outlook:${key}` : null, c =>
    Promise.all(active.map(async d => {
      const r = valueOf<Partial<DepotOutlook>>(await c.fn('Plans', null, 'CapacityOutlook', { depot: d }));
      return { depot: d, weeks: r?.weeks ?? [], uncoveredWeeks: r?.uncoveredWeeks ?? [], basis: r?.basis ?? null, reason: r?.reason ?? null };
    })),
  );
  const workshop = useQuery<Vehicle[]>(key ? `reefers-out:${key}` : null, c =>
    c.all<Vehicle>('Vehicles', { filter: ["tempClass eq 'CHILLED'", "status eq 'WORKSHOP'", depotFilter('depot', active)].filter(Boolean).join(' and '), select: 'id,depot' }),
  );

  const tripsPerDay = useAgentConfig().data?.limits?.maxTripsPerVehicle;
  const data = outlook.data ?? [];
  const rows = data
    .flatMap(o => o.weeks.map(w => toRow(o.depot, w, tripsPerDay)))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || active.indexOf(a.depot) - active.indexOf(b.depot));
  const weekKeys = [...new Set(rows.map(r => r.week))];
  const weeks: OutlookWeek[] = weekKeys.map(k => {
    const of = rows.filter(r => r.week === k);
    return {
      ...of[0],
      estimatedChilledDemandM3: of.reduce((s, r) => s + r.estimatedChilledDemandM3, 0),
      estimatedTotalM3: of.reduce((s, r) => s + r.estimatedTotalM3, 0),
      hasPayday: of.some(r => r.hasPayday),
      festival: of.find(r => r.festival)?.festival ?? null,
    };
  });
  const peak = rows.filter(r => r.headroom !== null).sort((a, b) => a.headroom! - b.headroom! || a.weekStart.localeCompare(b.weekStart))[0];
  const peakBad = Boolean(peak && peak.headroom! < 0);
  const stripDepot = depot ?? peak?.depot ?? active[0];
  const strip = stripDepot ? { depot: stripDepot, rows: weekKeys.map(k => rows.find(r => r.week === k && r.depot === stripDepot)!).filter(Boolean) } : null;
  const usual = usualDays(weeks);
  const out = (workshop.data ?? []).filter(v => v.depot === peak?.depot).map(v => v.id);
  const now = new Date();

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-05 Capacity outlook">
      <div className="d-app">
        <PlanSide active="N6" />
        <div className="d-main" style={{ gap: '16px' }}>
          <div className="d-head" style={{ alignItems: 'center' }}>
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {`${fmtDay(now)}, ${fmtTime(now)} `}
                {weeks.length > 0 && <><span className="m-sep" />{` Next ${weeks.length} weeks, ${weeks[0].week} to ${weeks[weeks.length - 1].week}`}</>}
              </div>
              <div className="d-h1">{"Capacity outlook"}</div>
            </div>
            <span className="m-tag m-tag--info" style={{ marginRight: '6px' }}><Ic n="info" />{"Advisory forecast, you decide"}</span>
            {depots.length > 1 && (
              <div className="d-toolbar">
                {([null, ...depots] as Array<Depot | null>).map(d => (
                  <span
                    key={d ?? 'all'}
                    className={`d-filter lv-click${depot === d ? ' is-on' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={depot === d}
                    onClick={e => { e.stopPropagation(); setDepot(d); }}
                    onKeyDown={e => { if (e.key === 'Enter') setDepot(d); }}
                  >
                    {d ? depotShort(d) : depots.length === 2 ? 'Both depots' : 'All depots'}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ErrorBanner error={outlook.error ?? workshop.error} onRetry={() => { void outlook.refresh(); void workshop.refresh(); }} />
          {peak && (
            <div className="d-kpis" style={{ gap: '16px' }}>
              <div className={`d-kpi${peakBad ? ' d-kpi--alert' : ''} x-kpi-xl`} style={{ flex: '1', justifyContent: 'center', gap: '8px' }} data-testid="peak-week">
                <span className="d-kpi__l" style={peakBad ? { color: 'var(--st-exception-fg)' } : undefined}>Peak week · {peak.week} · {depotShort(peak.depot)}</span>
                <div className="hstack" style={{ gap: '16px', alignItems: 'center' }}>
                  <span className="d-kpi__v" style={{ ...(peakBad ? { color: 'var(--st-exception-fg)' } : {}), whiteSpace: 'nowrap' }}>{signed(peak.headroom!)}<small>{"trips"}</small></span>
                  <span className="d-kpi__s" style={{ lineHeight: '1.45' }}>
                    <b>{peak.needed}</b>{" reefer trips needed vs "}<b>{peak.available}</b>
                    {` available (${peak.reeferVehiclesAvailable} × ${tripsPerDay} × ${peak.operatingDays}${out.length ? `, ${out.join(', ')} out` : ''}).`}
                    {peakBad && peak.perTrip ? ` About ${fmtNum(-peak.headroom! * peak.perTrip)} m³ chilled would be deferred.` : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* the pane scrolls: the chart and the table keep their full height instead of sharing the window's */}
          <div className="d-split" style={{ gap: '18px', flexShrink: 0, alignItems: 'flex-start' }}>
            <div className="x-col" style={{ flex: '1', gap: '16px', minWidth: 0 }}>
              <div className="d-card" style={{ flexShrink: '0' }}>
                <div className="d-card__head" style={{ minHeight: '48px', flexWrap: 'wrap', rowGap: '4px' }}>
                  <span className="d-card__title" style={{ whiteSpace: 'nowrap' }}>{"Forecast volume by ISO week"}</span>
                  <span className="x-note">{"m³ per week · chilled stacked under total"}</span>
                  <span className="spacer" />
                  <div className="x-legend">
                    <span><i className="x-sw" style={{ background: '#0E7490' }} />{"Chilled"}</span>
                    <span><i className="x-sw" style={{ background: '#C9D0DB' }} />{"Ambient"}</span>
                  </div>
                </div>
                <div style={{ padding: '0 18px 8px' }}>
                  {!outlook.data && !outlook.error && <Skeleton rows={3} label="Loading the outlook…" />}
                  {outlook.data && weeks.length === 0 && (
                    <Empty title="No forecast" icon="chart" text={data.map(o => `${depotShort(o.depot)}: ${o.reason ?? (o.uncoveredWeeks.length ? `no calendar rows for ${o.uncoveredWeeks[0]} to ${o.uncoveredWeeks[o.uncoveredWeeks.length - 1]}` : 'no weeks returned')}`).join(' · ')} />
                  )}
                  {weeks.length > 0 && <Chart weeks={weeks} peakWeek={peak?.week} peakBad={peakBad} strip={strip} />}
                </div>
              </div>
              <div className="d-card" style={{ flexShrink: 0, overflowX: 'auto' }}>
                <div className="d-table" data-testid="outlook-table">
                  <div className="d-tr d-tr--head" style={{ minHeight: '34px' }}>
                    <span className="d-td" style={{ width: '48px' }}>{"Week"}</span>
                    <span className="d-td" style={{ width: '92px' }}>{"Depot"}</span>
                    <span className="d-td x-num" style={{ width: '60px' }}>{"Chilled"}</span>
                    <span className="d-td x-num" style={{ width: '96px' }}>{"Reefer trips"}</span>
                    <span className="d-td" style={{ width: '96px' }}>{"Headroom"}</span>
                    <span className="d-td" style={{ flex: '1' }}>{"Signal"}</span>
                  </div>
                  {!outlook.data && !outlook.error && <Skeleton rows={4} />}
                  {rows.map(r => {
                    const bad = r.headroom !== null && r.headroom < 0;
                    return (
                      <div key={`${r.week}:${r.depot}`} className={`d-tr x-otr${bad ? ' is-bad' : ''}`} data-week={r.week} data-depot={r.depot}>
                        <span className="d-td id" style={{ width: '48px', ...(bad ? { color: 'var(--st-exception-fg)', fontWeight: '800' } : {}) }}>{r.week}</span>
                        <span className={`d-td${bad ? ' fw7' : ''}`} style={{ width: '92px' }}>{depotShort(r.depot)}</span>
                        <span className={`d-td x-num${bad ? ' fw7' : ''}`} style={{ width: '60px' }}>{fmtNum(r.estimatedChilledDemandM3)}</span>
                        <span className={`d-td x-num${bad ? ' fw7' : ''}`} style={{ width: '96px' }}>{r.needed ?? '—'} / {r.available ?? '—'}</span>
                        <span className="d-td" style={{ width: '96px' }}><Headroom r={r} /></span>
                        <span className="d-td x-meta" style={{ flex: '1', minWidth: '0' }}><Signal w={r} usual={usual} /></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="x-col" style={{ width: '316px', flexShrink: '0', gap: '14px' }}>
              <div className="x-handled" style={{ background: 'transparent', padding: '4px 6px', flexDirection: 'column', gap: '4px' }}>
                <span className="x-sect" data-lk="L165"><Ic n="chart" className="ic ic--sm" />{"Forecast model"}</span>
                <span data-testid="forecast-basis">
                  {data.length > 0 && data.every(o => o.basis?.method === 'model')
                    ? "The demand model forecasts each week's total and chilled m³ per depot and brand from the order history and the calendar (paydays, festivals, monsoon). "
                    : "Each operating day in the calendar gets the depot's median daily volume from its past run dates, × (1 + festival_ramp). "}
                  {data.map(o => (
                    <span key={o.depot} style={{ display: 'block' }}>
                      <b className="t-2">{depotShort(o.depot)}</b>
                      {o.basis?.method === 'model'
                        ? ': demand model.'
                        : o.basis && o.basis.historyDays > 0 && o.basis.historyFrom && o.basis.historyTo
                        ? `: ${fmtNum(o.basis.historyDays)} run dates, ${dayMonth(o.basis.historyFrom)} to ${dayMonth(o.basis.historyTo)} · median ${fmtNum(o.basis.medianTotalM3PerDay ?? 0, 1)} m³ a day, ${fmtNum(o.basis.medianChilledM3PerDay ?? 0, 1)} chilled.`
                        : ': no past run dates yet.'}
                      {o.reason ? ` ${o.reason}` : ''}
                      {o.uncoveredWeeks.length > 0 ? ` No calendar rows yet for ${o.uncoveredWeeks[0]}${o.uncoveredWeeks.length > 1 ? ` to ${o.uncoveredWeeks[o.uncoveredWeeks.length - 1]}` : ''}, so no forecast there.` : ''}
                    </span>
                  ))}
                  {!outlook.data && '…'}
                  <b className="t-2">{"Advisory:"}</b>{" Lodestar never books vehicles or defers orders on its own."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
