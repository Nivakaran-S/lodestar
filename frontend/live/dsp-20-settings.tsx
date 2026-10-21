'use client';
// DSP-20 Settings, live. Markup and classes from the generated design (frontend/screens/dsp-20-settings.tsx).
// Data: the planning agent's limits (AgentRuns/Lodestar.AgentConfig: first departure, Fresh/other minute budgets,
// trips per vehicle, reason codes, protected score), Calendar (run days and the next closed days), Vehicles and
// DistrictTravel counts per depot, Users of the dispatcher's depots, Outlets with an access note (the notes the
// agent reads with the outlet rows), and the dispatcher's own alert rules and on-call hours
// (Users/Lodestar.MyPreferences, saved with SaveMyPreferences; the phone's DSP-33 reads the same rules). The order
// cut-off, deferral score weights, protected score, late-risk threshold choices and the default alert rules come
// from the planning service (Plans/Lodestar.PlanningRules), the same values its scoring code uses.
// The planning rules are enforced in code (planning, agent): they show with a lock and cannot be edited here.
// "Save changes" saves the alert rules and goes to Today (the design's L170). Added to the design: the "Alert
// rules" card (DSP-14's "Alert rules" opens this screen). Not drawn: "Add code", "Invite", the notes' "+" and
// "Loading starts" (no endpoint: reason codes are fixed, people are invited in Lodestar Admin, notes are edited
// on the outlet by an admin, and Lodestar keeps no loading-start time).
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Btn from '@/components/live/Btn';
import { PlanSide } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { type AlertRules, type Preferences, SMS_UNAVAILABLE, useAgentConfig, useDeliveryChannels, usePreferences } from '@/components/live/settings-data';
import { ErrorBanner, Skeleton } from '@/components/live/states';
import { usePlanScope } from '@/components/live/plan-data';
import { addDays, isoDay } from '@/lib/format';
import { useQuery } from '@/lib/odata/hooks';
import type { Outlet, User, UserRole } from '@/lib/odata/types';
import { colomboDay, depotFilter } from '@/lib/workday';
import { clock12, usePlanningRules } from '@/components/live/planning-rules';
import { useDepots } from '@/components/live/depots';

const REASON_TEXT: Record<string, string> = {
  CAP_REEFER: 'Not enough reefer space',
  CAP_TIME: "Won't fit the trip's minute budget",
  ACCESS: "Vehicle can't reach the outlet",
  WINDOW: 'Arrival misses the window',
  FUEL: 'Weekly fuel quota exceeded',
  VEH_DOWN: 'Vehicle failed or in workshop',
};
const ROLE_PILL: Record<UserRole, string> = { ADMIN: 'Admin', DISPATCHER: 'Plan', LOADER: 'Dock', DRIVER: 'Run', STORE_MANAGER: 'Store' };
const ROLE_LABEL: Record<UserRole, string> = { ADMIN: 'Admin', DISPATCHER: 'Dispatcher', LOADER: 'Loader', DRIVER: 'Driver', STORE_MANAGER: 'Store manager' };
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NO_ALERTS: Required<AlertRules> = { vehicleFault: {}, lateRisk: {}, flags: {}, silence: {}, signalZones: {} };
const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

const hhmm = (min: number) => `${Math.floor(min / 60) % 24}:${String(min % 60).padStart(2, '0')}`;
const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + (m || 0); };
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
const dm = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function Toggle({ on, onChange, label, locked, unavailable }: { on: boolean; onChange?: (v: boolean) => void; label: string; locked?: boolean; unavailable?: string }) {
  // a channel this deployment does not offer (SMS without SMS_ENABLED): shown off and disabled, with the reason
  if (unavailable) return <span className="dx-toggle dx-toggle--off" aria-label={label} aria-checked={false} aria-disabled="true" role="switch" title={unavailable} style={{ opacity: 0.45 }}><i /></span>;
  if (locked || !onChange) return <span className={`dx-toggle${on ? '' : ' dx-toggle--off'}`} aria-label={label} aria-checked={on} role="switch"><i /></span>;
  return (
    <span className={`dx-toggle lv-click${on ? '' : ' dx-toggle--off'}`} role="switch" aria-checked={on} aria-label={label} tabIndex={0}
      onClick={e => { e.stopPropagation(); onChange(!on); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!on); } }}>
      <i />
    </span>
  );
}

function Kv({ label, children, style }: { label: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return <div className="dx-kv" style={style}><span>{label}</span><b>{children}</b></div>;
}

export default function LiveDsp20Settings() {
  const { name: depotName } = useDepots();
  const router = useRouter();
  const { active } = usePlanScope();
  const prefs = usePreferences();
  // SMS only when the deployment sends it (Notifications/Lodestar.Channels); there is no call channel at all
  const smsOff = useDeliveryChannels().data?.sms === true ? undefined : SMS_UNAVAILABLE;
  const config = useAgentConfig();
  const rules = usePlanningRules();
  const r = rules.data;
  // a dispatcher who saved no alert rules gets the planning service's defaults (PlanningRules.alertDefaults)
  const alertDefaults: Required<AlertRules> = r?.alertDefaults ?? NO_ALERTS;
  const today = colomboDay();
  const calendar = useQuery<Array<{ date: string; isOperating: boolean; festivalName?: string | null }>>(`dsp20-cal:${today}`, c =>
    c.all('Calendar', { filter: `date ge ${today} and date le ${addDays(today, 60)}`, select: 'date,isOperating,festivalName', orderby: 'date' }),
  );
  const key = active.join(',');
  const depots = useQuery<Array<{ depot: string; vehicles: number; districts: number }>>(key ? `dsp20-depots:${key}` : null, c =>
    Promise.all(active.map(async d => ({
      depot: d,
      vehicles: (await c.list('Vehicles', { filter: `depot eq '${d}'`, top: 0, count: true })).count ?? 0,
      districts: (await c.list('DistrictTravel', { filter: `depot eq '${d}'`, top: 0, count: true })).count ?? 0,
    }))),
  );
  const users = useQuery<User[]>(key ? `dsp20-users:${key}` : null, c =>
    c.all<User>('Users', { filter: ['isActive eq true', depotFilter('depot', active)].filter(Boolean).join(' and '), select: 'id,name,role,depot,outletId', orderby: 'role,name', top: 6 }, 1),
  );
  const notes = useQuery<Outlet[]>(key ? `dsp20-notes:${key}` : null, c =>
    c.all<Outlet>('Outlets', { filter: ['accessNote ne null', depotFilter('depot', active)].filter(Boolean).join(' and '), select: 'id,name,district,depot,accessNote', orderby: 'id', top: 6 }, 1),
  );

  // Local edits on top of the saved preferences; null = nothing edited.
  const [edit, setEdit] = useState<Preferences | null>(null);
  const draft: Preferences | null = edit ?? prefs.data ?? null;
  const setDraft = (next: Preferences | ((d: Preferences | null) => Preferences)) =>
    setEdit(e => (typeof next === 'function' ? next(e ?? prefs.data ?? null) : next));
  const alerts: Required<AlertRules> = { ...alertDefaults, ...(draft?.alerts ?? {}) } as Required<AlertRules>;
  // on-call hours are only what the dispatcher saved (MyPreferences); none set = empty, as on the phone (DSP-33)
  const onCall = { from: '', to: '', ...(draft?.onCall ?? {}) };
  const setAlert = <K extends keyof AlertRules>(k: K, v: Partial<NonNullable<AlertRules[K]>>) =>
    setDraft(d => ({ ...(d ?? {}), alerts: { ...alertDefaults, ...(d?.alerts ?? {}), [k]: { ...alertDefaults[k], ...(d?.alerts?.[k] ?? {}), ...v } } }));
  const dirty = edit !== null && JSON.stringify(edit) !== JSON.stringify(prefs.data ?? {});

  const runDays = useMemo(() => {
    const rows = calendar.data ?? [];
    const open = new Set(rows.filter(r => r.isOperating).map(r => new Date(r.date).getUTCDay()));
    const days = [1, 2, 3, 4, 5, 6, 0].filter(d => open.has(d));
    if (!days.length) return '—';
    const contiguous = days.every((d, i) => i === 0 || d === (days[i - 1] + 1) % 7);
    return contiguous ? `${DAY[days[0]]} to ${DAY[days[days.length - 1]]}` : days.map(d => DAY[d]).join(', ');
  }, [calendar.data]);
  const closed = useMemo(() => {
    const rows = (calendar.data ?? []).filter(r => !r.isOperating && new Date(r.date).getUTCDay() !== 0).map(r => isoDay(r.date));
    return rows.slice(0, 4).map(dm).join(', ') || 'None in the next 60 days';
  }, [calendar.data]);

  const c = config.data;
  const freshStart = c ? toMin(c.firstDeparture) : null;
  const save = () => void prefs.save.run({ alerts: draft?.alerts ?? alertDefaults, ...(onCall.from && onCall.to ? { onCall } : {}) })
    .then(r => { if (r) { setEdit(null); router.push('/plan/dsp-08-today-overview'); } });

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-20 Settings · desktop">
      <div className="d-app">
        <PlanSide active="N9" />
        <div className="dx-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">{"Settings "}<span className="m-sep" />{" Both depots unless marked "}<span className="m-sep" />{" changes apply from the next cutoff"}</div>
              <div className="d-h1">{"Planning rules and people"}</div>
            </div>
            <Btn className="d-btn d-btn--ghost" disabled={!dirty} onClick={() => setEdit(null)}>{"Discard"}</Btn>
            <Btn className="d-btn d-btn--primary" lk="L170" busy={prefs.save.pending} disabled={!draft} onClick={save}><Ic n="check" />{"Save changes"}</Btn>
          </div>
          <ErrorBanner error={prefs.error ?? prefs.save.error ?? config.error ?? rules.error} onRetry={() => { void prefs.refresh(); void config.refresh(); void rules.refresh(); }} />
          <div className="dx-hrow" style={{ flex: '1' }}>
            <div className="dx-col" style={{ flex: '1' }}>
              <div className="dx-card">
                <div className="dx-card__head"><span className="dx-card__title">{"Order cutoff"}</span></div>
                <div className="dx-card__body" style={{ gap: '10px' }}>
                  <div className="vstack" style={{ gap: '4px' }}>
                    <span className="dx-display">{r ? clock12(r.cutoff) : '…'}</span>
                    <span className="dx-t14">{"the day before each run"}</span>
                  </div>
                  <div className="dx-input dx-input--sm" style={{ width: '180px' }} title="Set in the planning service: the same for every depot">
                    <Ic n="clock" />{r?.cutoff ?? '…'}<span className="spacer" /><Ic n="lock" />
                  </div>
                  <span className="dx-t13">{"At cutoff the planning agent starts the draft. Later orders roll to the next run and the store is told."}</span>
                </div>
              </div>
              <div className="dx-card">
                <div className="dx-card__head"><span className="dx-card__title">{"Runs"}</span></div>
                <div className="dx-card__body" style={{ gap: '0' }}>
                  {!calendar.data && !calendar.error && !c ? <Skeleton rows={3} /> : (
                    <>
                      <Kv label="Run days">{runDays}</Kv>
                      <Kv label="Closed, from calendar">{closed}</Kv>
                      <Kv label="Fresh window">{c && freshStart !== null ? `${hhmm(freshStart)} to ${hhmm(freshStart + c.limits.freshMinutesBudget)} · ${c.limits.freshMinutesBudget} min` : '—'}</Kv>
                      <Kv label="Style and Tech day">{c ? `${c.limits.otherMinutesBudget} min` : '—'}</Kv>
                      <Kv label="Trips per vehicle">{c ? `Max ${c.limits.maxTripsPerVehicle} a day` : '—'}</Kv>
                    </>
                  )}
                </div>
              </div>
              <div className="dx-card" style={{ flex: '1' }} data-testid="alert-rules">
                <div className="dx-card__head">
                  <span className="dx-card__title">{"Alert rules"}</span>
                  <span className="spacer" />
                  <span className="dx-t13">{"yours, on this desk and your phone"}</span>
                </div>
                <div className="dx-card__body" style={{ gap: '0' }}>
                  {!draft || !r ? <Skeleton rows={4} /> : (
                    <>
                      <div className="dx-kv"><span>{"Vehicle can't depart"}</span><span className="hstack" style={{ gap: '8px' }}><span className="dx-t13">{"push"}</span><Toggle label="Vehicle fault push" on={!!alerts.vehicleFault.push} onChange={v => setAlert('vehicleFault', { push: v })} /><span className="dx-t13" title={smsOff}>{"SMS"}</span><Toggle label="Vehicle fault SMS" on={!smsOff && !!alerts.vehicleFault.sms} onChange={v => setAlert('vehicleFault', { sms: v })} unavailable={smsOff} /></span></div>
                      {smsOff && <div className="dx-t13" data-testid="sms-unavailable" style={{ padding: '0 0 6px' }}>{`SMS: ${smsOff}`}</div>}
                      <div className="dx-kv">
                        <span className="hstack" style={{ gap: '6px' }}>{"Late risk"}
                          <select className="lv-input" aria-label="Late risk threshold" style={{ width: 'auto', height: '30px' }} value={alerts.lateRisk.threshold ?? r.lateRisk.alertPct}
                            onChange={e => setAlert('lateRisk', { threshold: Number(e.target.value) })} onClick={e => e.stopPropagation()}>
                            {r.lateRisk.thresholdOptions.map(n => <option key={n} value={n}>{`${n}% or more`}</option>)}
                          </select>
                        </span>
                        <Toggle label="Late risk push" on={!!alerts.lateRisk.push} onChange={v => setAlert('lateRisk', { push: v })} />
                      </div>
                      <div className="dx-kv"><span>{"Loader and store flags"}</span><Toggle label="Flags push" on={!!alerts.flags.push} onChange={v => setAlert('flags', { push: v })} /></div>
                      <div className="dx-kv"><span>{`Silent ${alerts.silence.minutes ?? r.alertDefaults.silence.minutes} min, unknown place`}</span><Toggle label="Silence push" on={!!alerts.silence.push} onChange={v => setAlert('silence', { push: v })} /></div>
                      <div className="dx-kv"><span>{"Known signal-loss zones alert"}</span><Toggle label="Signal-loss zones" on={!!alerts.signalZones.alert} onChange={v => setAlert('signalZones', { alert: v })} /></div>
                      <div className="dx-kv">
                        <span>{"On call"}</span>
                        <span className="hstack" style={{ gap: '6px' }}>
                          <input className="lv-input" type="time" aria-label="On call from" style={{ width: '110px', height: '30px' }} value={onCall.from} onChange={e => setDraft(d => ({ ...(d ?? {}), onCall: { ...onCall, from: e.target.value } }))} />
                          {"to"}
                          <input className="lv-input" type="time" aria-label="On call to" style={{ width: '110px', height: '30px' }} value={onCall.to} onChange={e => setDraft(d => ({ ...(d ?? {}), onCall: { ...onCall, to: e.target.value } }))} />
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="dx-col" style={{ flex: '1.1' }}>
              <div className="dx-card">
                <div className="dx-card__head"><span className="dx-card__title">{"Reason codes"}</span></div>
                <div className="dx-card__body" style={{ gap: '0' }} data-testid="reason-codes">
                  {!c && !config.error && <Skeleton rows={3} />}
                  {c?.reasonCodes.map(code => (
                    <div key={code} className="dx-kv" style={{ minHeight: '40px' }}>
                      <span className="hstack" style={{ gap: '10px' }}><span className="dx-code">{code}</span><span style={{ color: 'var(--text-2)' }}>{code === 'CAP_TIME' && c ? `Won't fit the ${c.limits.freshMinutesBudget} or ${c.limits.otherMinutesBudget} min day` : REASON_TEXT[code] ?? ''}</span></span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dx-card" style={{ flex: '1' }}>
                <div className="dx-card__head"><span className="dx-card__title">{"Deferral score weights"}</span><span className="spacer" /><span className="dx-t13">{"higher = keep"}</span></div>
                <div className="dx-card__body" style={{ gap: '0' }}>
                  {!r && !rules.error && <Skeleton rows={5} />}
                  {r && (
                    <>
                      <Kv label="Deferred on the previous run"><span style={{ fontSize: '14px', color: 'var(--text)' }}>{signed(r.deferral.weights.deferredYesterday)}</span></Kv>
                      <Kv label="Days since last served"><span style={{ fontSize: '14px', color: 'var(--text)' }}>{`×${r.deferral.weights.perDaySince} a day`}</span></Kv>
                      <Kv label="Chilled order"><span style={{ fontSize: '14px', color: 'var(--text)' }}>{signed(r.deferral.weights.chilled)}</span></Kv>
                      <Kv label="Fresh, before the store opens"><span style={{ fontSize: '14px', color: 'var(--text)' }}>{signed(r.deferral.weights.freshBeforeOpening)}</span></Kv>
                      <Kv label="Next run within 24 h"><span style={{ fontSize: '14px', color: 'var(--st-delivered-fg)' }}>{signed(r.deferral.weights.nextRunWithin24h)}</span></Kv>
                      <Kv label="Stock cover"><span style={{ fontSize: '14px', color: 'var(--text)' }}>{`${signed(r.deferral.weights.stockCoverPerDay)} a day of cover, up to ${signed(-r.deferral.weights.stockCoverCap)}`}<span style={{ display: 'block', fontSize: '13px', color: 'var(--text-3)' }}>{"Not applied yet: stores don't send stock levels to Lodestar"}</span></span></Kv>
                    </>
                  )}
                  <div className="hstack" style={{ gap: '12px', marginTop: '10px', fontSize: '14px' }}>
                    <Toggle label="Protect outlets deferred on the previous run" on locked />
                    <span><b>{"Protect"}</b>{` outlets deferred on the previous run${r ? ` (score ${r.deferral.protectedScore} or more is never deferred)` : ''}`}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="dx-col" style={{ flex: '1' }}>
              <div className="dx-card">
                <div className="dx-card__head"><span className="dx-card__title">{"Depots"}</span></div>
                <div className="dx-card__body" style={{ gap: '0' }}>
                  <ErrorBanner error={depots.error} onRetry={depots.refresh} compact />
                  {!depots.data && !depots.error && <Skeleton rows={2} />}
                  {depots.data?.map(d => (
                    <div key={d.depot} className="dx-kv" style={{ minHeight: '54px' }}>
                      <span className="hstack" style={{ gap: '10px' }}>
                        <span className="dx-lead" style={{ width: '34px', height: '34px' }}><Ic n="depot" /></span>
                        <span className="dx-td2"><b>{depotName(d.depot)}</b><span>{`${d.districts} districts`}</span></span>
                      </span>
                      <b>{`${d.vehicles} vehicles`}</b>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dx-card">
                <div className="dx-card__head"><span className="dx-card__title">{"Users and roles"}</span></div>
                <div className="dx-card__body" style={{ gap: '0' }}>
                  <ErrorBanner error={users.error} onRetry={users.refresh} compact />
                  {!users.data && !users.error && <Skeleton rows={3} />}
                  {users.data?.map((u, i) => (
                    <div key={u.id} className="dx-kv" style={{ minHeight: '50px' }}>
                      <span className="hstack" style={{ gap: '10px' }}>
                        <span className="d-avatar" style={i ? { background: 'var(--tint-brand)', color: 'var(--brand-600)' } : undefined}>{initials(u.name)}</span>
                        <span className="dx-td2"><b>{u.name}</b><span>{`${ROLE_LABEL[u.role]} · ${u.outletId ?? (u.depot ? depotName(u.depot) : 'both depots')}`}</span></span>
                      </span>
                      <b className="m-pill" style={{ height: '26px', fontSize: '13px' }}>{ROLE_PILL[u.role]}</b>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dx-card" style={{ flex: '1' }}>
                <div className="dx-card__head"><span className="dx-card__title">{"Dispatcher notes the agent uses"}</span></div>
                <div className="dx-card__body" style={{ gap: '0' }}>
                  <ErrorBanner error={notes.error} onRetry={notes.refresh} compact />
                  {notes.data?.length === 0 && <span className="dx-t13">{"No outlet has an access note yet."}</span>}
                  {notes.data?.map(o => (
                    <div key={o.id} className="dx-kv" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minHeight: '0', paddingTop: '8px', paddingBottom: '8px' }}>
                      <span className="hstack" style={{ gap: '8px' }}><span className="id" style={{ color: 'var(--text)' }}>{o.id}</span><b style={{ fontSize: '14px' }}>{o.district}</b></span>
                      <span style={{ fontSize: '13.5px', lineHeight: '1.4', color: 'var(--text-2)', whiteSpace: 'normal' }}>{o.accessNote}</span>
                      <span className="dx-t13">{`${o.name} · ${depotName(o.depot)}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
