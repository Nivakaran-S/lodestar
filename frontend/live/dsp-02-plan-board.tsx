'use client';
// DSP-02 Plan board, live. Markup and classes from the generated design (frontend/screens/dsp-02-plan-board.tsx).
// Data: the plan of the run date (Plans), its Trips with vehicles and stops, Orders for sizes, Vehicles in the
// workshop, and — when a planning-agent run is under review — that run's draft (AgentRuns detail: trips, rule
// checks, deferrals, explanation). Approving happens on DSP-12; the agent never publishes.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Btn from '@/components/live/Btn';
import { PlanSide } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { idleSummary, Lane, tripTwoHead, useBoardCards } from '@/components/live/board';
import { infeasibility, PLAN_EVENTS, useReviewRun, usePlanScope } from '@/components/live/plan-data';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { fmtNum, fmtRunDate, fmtTime, planNote, title } from '@/lib/format';
import { usePlanningRules } from '@/components/live/planning-rules';
import { useQuery } from '@/lib/odata/hooks';
import type { AgentRunDetail, Plan } from '@/lib/odata/types';
import { openOverlay } from '@/lib/overlay';
import { useFocusId } from '@/lib/workday';
import type { Card } from '@/components/live/board';

const TRIP_DRAWER = '/plan/dsp-11-trip-and-vehicle-drawer';

export default function LiveDsp02PlanBoard() {
  const warnPct = usePlanningRules().data?.load.warnPct;
  const router = useRouter();
  const scope = usePlanScope();
  const { runDate, tripsFilter, plansFilter, ordersFilter, active } = scope;
  const { run } = useReviewRun();
  const draft: AgentRunDetail | null = run.data?.status === 'NEEDS_APPROVAL' ? run.data.detail ?? null : null;
  const [view, setView] = useState<'draft' | 'live' | null>(null);
  const showing = view ?? (draft ? 'draft' : 'live');

  const plan = useQuery<Plan | null>(plansFilter ? `plan:${plansFilter}` : null, async c => (await c.list<Plan>('Plans', { filter: plansFilter, orderby: 'runDate desc,version desc', top: 1 })).value[0] ?? null, {
    refreshOn: PLAN_EVENTS,
  });
  const board = useBoardCards({ draft: showing === 'draft' ? draft : null, tripsFilter, ordersFilter, active });
  const { trips, orders, fleet, vehicles, cards, lanes, down, idle, loading } = board;
  const [, setFocusTrip] = useFocusId('trip');
  const [, setFocusVehicle] = useFocusId('vehicle');
  // a trip card (or its vehicle) opens that trip in the drawer over the board: a draft trip by its draft id
  const openTrip = (c: Card) => { setFocusTrip(c.id); setFocusVehicle(c.vehicleId); openOverlay(TRIP_DRAWER); };
  const p = plan.data;
  const deferrals = draft?.deferrals ?? [];
  const review = draft?.needsReview ?? [];
  // the draft cannot serve the run as the rules stand: DSP-23 Plan infeasible says why
  const blocked = draft ? infeasibility(run.data) : null;
  const openInfeasible = () => router.push('/plan/dsp-23-plan-infeasible');
  const totalOrders = (orders.data ?? []).filter(o => o.status !== 'CANCELLED').length;
  const planned = showing === 'draft' ? cards.reduce((s, c) => s + c.stops, 0) : (orders.data ?? []).filter(o => !['RECEIVED', 'DEFERRED', 'CANCELLED'].includes(o.status)).length;
  const toApprove = Boolean(draft) || p?.status === 'NEEDS_APPROVAL' || p?.status === 'DRAFT';
  const checks = draft?.ruleChecks ?? [];
  const firstDepart = cards.map(c => c.departs).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))[0];

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-02 Plan board">
      <div className="d-app">
        <PlanSide active="N2" />
        <div className="d-main" style={{ flexDirection: 'row', gap: '20px' }}>
          <div className="x-col" style={{ flex: '1', gap: '16px' }}>
            <div className="d-head">
              <div className="d-head__txt">
                <div className="d-eyebrow">
                  {showing === 'draft' && draft ? (
                    <>{"Draft by planning agent "}<span className="m-sep" />{` v${draft.plan?.version ?? draft.version ?? ''} `}<span className="m-sep" /><span className="m-tag m-tag--warn"><span className="dot" />{"waiting for your approval"}</span></>
                  ) : p ? (
                    <>{`${p.source === 'AGENT' ? 'Agent' : p.source === 'AUTOPLAN' ? 'Auto-plan' : 'Manual'} plan `}<span className="m-sep" />{` v${p.version} `}<span className="m-sep" /><span className={`m-tag ${p.status === 'PUBLISHED' || p.status === 'APPROVED' ? 'm-tag--ok' : 'm-tag--warn'}`}><span className="dot" />{title(p.status)}</span></>
                  ) : (
                    <>{plan.loading ? 'Loading plan…' : 'No plan for this run date yet'}</>
                  )}
                </div>
                <div className="d-h1">Plan for {runDate ? fmtRunDate(runDate) : '…'}</div>
              </div>
              {draft && (
                <div className="m-seg" style={{ margin: '0', width: '230px' }}>
                  {(['draft', 'live'] as const).map(k => (
                    <span key={k} className={`m-seg__i lv-click${showing === k ? ' is-on' : ''}`} style={{ height: '30px', fontSize: '13px' }} role="button" tabIndex={0}
                      onClick={e => { e.stopPropagation(); setView(k); }} onKeyDown={e => { if (e.key === 'Enter') setView(k); }}>
                      {k === 'draft' ? 'Agent draft' : 'Current trips'}
                    </span>
                  ))}
                </div>
              )}
              <Btn
                className={`d-btn${toApprove ? '' : ' d-btn--disabled'}`}
                disabled={!toApprove}
                testId="to-approve"
                onClick={() => openOverlay('/plan/dsp-12-approve-and-go-live')}
              >
                <Ic n="lock" />{"Approve & go live"}
              </Btn>
              <span className="d-btn d-btn--primary" data-lk="L3"><Ic n="history" />Review deferrals{deferrals.length ? ` (${deferrals.length})` : ''}</span>
            </div>
            <ErrorBanner error={trips.error ?? fleet.error ?? run.error} onRetry={() => { void trips.refresh(); void fleet.refresh(); }} />
            {blocked && (
              <div className="lv-banner lv-banner--warn" role="status" data-testid="plan-infeasible">
                <Ic n="alert" />
                <div className="lv-banner__txt">
                  <b>{"This draft can't serve every order as the rules stand"}</b>
                  <span>
                    {blocked.review.length ? `${blocked.review.length} protected order${blocked.review.length === 1 ? '' : 's'} could not be placed` : ''}
                    {blocked.review.length && blocked.violations.length ? ' · ' : ''}
                    {blocked.violations.length ? `${blocked.violations.length} rule conflict${blocked.violations.length === 1 ? '' : 's'} left` : ''}
                    {blocked.shortM3 > 0 ? ` · ${fmtNum(blocked.shortM3, 1)} m³ chilled short` : ''}
                  </span>
                </div>
                <Btn className="d-btn d-btn--ghost lv-btn" onClick={openInfeasible}>{"See why"}<Ic n="chevron-right" /></Btn>
              </div>
            )}
            <div className="x-board" data-testid="board">
              <div className="x-lanehead">
                <span style={{ width: '168px' }}>{"Vehicle · minutes"}</span>
                <span style={{ flex: '1' }} data-lk="L155">Trip 1{firstDepart ? ` · departs ${fmtTime(firstDepart)}` : ''}</span>
                <span style={{ flex: '1' }}>{tripTwoHead(board.limits)}</span>
              </div>
              {loading && <Skeleton rows={4} label="Loading the plan board…" />}
              {!loading && lanes.length === 0 && (
                <Empty title="No trips on the board" text={showing === 'draft' ? 'The agent draft has no trips.' : 'No trips are planned for this run date in the depots in view.'} icon="truck" />
              )}
              {lanes.map(([id, cs]) => <Lane key={id} vehicleId={id} cards={cs} v={vehicles.get(id)} limits={board.limits} onOpen={openTrip} />)}
              {down.map(v => (
                <div key={v.id} className="x-lane">
                  <div className="x-veh" style={{ padding: '0 2px', justifyContent: 'center' }}>
                    <div className="x-veh__id" style={{ color: 'var(--text-3)' }}>
                      <span className="x-veh__ic" style={{ opacity: '.55' }}><Ic n="truck" /></span>
                      <span className="id" style={{ textDecoration: 'line-through' }}>{v.id}</span>
                    </div>
                  </div>
                  <div className="x-down">
                    <Ic n="alert" className="ic ic--sm" />
                    <b>In workshop, unavailable {runDate ? fmtRunDate(runDate) : ''}</b>
                    <span className="t-3">{v.tempClass === 'CHILLED' ? 'Reefer' : 'Dry'} {v.type === 'VAN' ? 'van' : 'truck'} · 0 trips{v.workshopNote ? ` · ${v.workshopNote}` : ''}</span>
                    <span className="spacer" />
                    <span className="x-code">{"VEH-DOWN"}</span>
                  </div>
                </div>
              ))}
              <div className="spacer" />
              <div className="x-boardfoot">
                <Ic n="chevron-down" className="ic ic--sm" />
                <span>{idleSummary(idle)}</span>
                <span className="spacer" />
                <span><i className="x-sw" style={{ background: 'var(--st-delivered-fg)' }} />{`under ${warnPct ?? '…'}%`}</span>
                <span><i className="x-sw" style={{ background: 'var(--star-500)' }} />{`${warnPct ?? '…'}% or more`}</span>
                <span><i className="x-sw" style={{ background: 'var(--st-exception-fg)' }} />{"over"}</span>
              </div>
            </div>
          </div>
          <div className="d-panel" style={{ width: '304px', gap: '14px' }}>
            <div className="x-hero">
              <span className="x-hero__l">{draft ? `Needs your judgement · draft v${draft.plan?.version ?? ''}` : 'Run picture'}</span>
              <div className="x-hero__v">{planned}<small>of {totalOrders} served</small></div>
              <div className="x-hseg">
                <div style={{ flex: String(Math.max(planned, 0)), background: '#34D399' }} />
                <div style={{ flex: String(review.length), background: '#8C98F2' }} />
                <div style={{ flex: String(deferrals.length), background: 'var(--star-500)' }} />
              </div>
              <div className="x-hero__m">{planned} planned · {review.length} to review · <b>{deferrals.length} to decide</b></div>
              {deferrals.slice(0, 2).map(d => (
                <div key={d.orderId} className="x-hrow">
                  <div className="x-hrow__main">
                    <span className="x-hrow__t">{d.orderId}<span className="id">{d.outletId}</span></span>
                    <span className="x-hrow__m">{d.reason} · {fmtNum(d.m3, 1)} m³</span>
                  </div>
                  <div className="x-hrow__s"><b>{d.score}</b>{"score"}</div>
                </div>
              ))}
              {review.length > 0 && (
                <div className="x-hlink lv-click" role="link" tabIndex={0} data-testid="to-review"
                  onClick={e => { e.stopPropagation(); openInfeasible(); }} onKeyDown={e => { if (e.key === 'Enter') openInfeasible(); }}>
                  <div className="vstack" style={{ gap: '2px', minWidth: '0' }}>
                    <div>{review.length} order{review.length === 1 ? '' : 's'} to review</div>
                    <span style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{review.slice(0, 2).map(r => r.orderId).join(' · ')}</span>
                  </div>
                  <Ic n="chevron-right" />
                </div>
              )}
            </div>
            <div className="d-card" style={{ flex: '1', minHeight: '0' }}>
              <div className="d-card__head" style={{ minHeight: '42px' }}>
                <Ic n="sparkle-plus" />
                <span className="d-card__title" data-lk="L43">{draft ? "Agent's reasoning" : 'Plan notes'}</span>
                <span className="spacer" />
                <span className="x-ck__v">{run.data ? fmtTime(run.data.updatedAt ?? run.data.createdAt) : p ? fmtTime(p.updatedAt ?? p.createdAt) : ''}</span>
              </div>
              <div className="d-card__body" style={{ gap: '8px', paddingBottom: '12px' }}>
                {draft?.explanation ? (
                  <>
                    <div className="x-sect">{"What it did"}</div>
                    {draft.explanation.did.map((t, i) => (
                      <div key={i} className="x-why"><span className="x-why__n">{i + 1}</span><span {...(i === draft.explanation!.did.length - 1 ? { 'data-lk': 'L156' } : {})}>{t}</span></div>
                    ))}
                  </>
                ) : (
                  <div className="dx-t14" style={{ whiteSpace: 'pre-line' }}>{planNote(p?.explanation ?? p?.notes) ?? (p ? 'No notes on this plan.' : 'Ask the planning agent to draft this run.')}</div>
                )}
                {checks.length > 0 && (
                  <>
                    <div className="x-sect" style={{ marginTop: '2px' }}>{"What it checked "}<span className="m-sep" /><span style={{ fontWeight: '600' }}>{checks.length} booklet rules</span></div>
                    <div className="vstack" style={{ gap: '0' }}>
                      {checks.map(c => (
                        <div key={c.rule} className="x-ck" data-rule={c.rule}>
                          <span className="x-ck__i" style={c.passed ? undefined : { color: 'var(--st-exception-fg)' }}><Ic n={c.passed ? 'check' : 'alert'} /></span>
                          <span className="x-ck__l">{c.label}</span>
                          <span className="x-ck__v">{c.passed ? 'pass' : `${c.violations} to fix`}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="x-meta" style={{ alignItems: 'flex-start', gap: '6px', fontSize: '12.5px', lineHeight: '1.4', whiteSpace: 'normal', color: 'var(--text-3)' }}>
                  <Ic n="info" className="ic ic--sm" />
                  <span>{draft ? 'Draft only. Not live until you approve.' : p?.approvedAt ? `Approved ${fmtTime(p.approvedAt)}.` : 'Not live yet.'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
