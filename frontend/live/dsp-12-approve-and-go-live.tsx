'use client';
// DSP-12 Approve and go live, live. Markup and classes from the generated design (frontend/screens/dsp-12-approve-and-go-live.tsx).
// A human dispatcher publishes here, and only here:
//  - a planning-agent draft: AgentRuns('…')/Lodestar.Resume {decision: 'approve'} (planning stores the draft as a
//    plan version and publishes it with the dispatcher's authority; the agent itself can never publish), or
//    {decision: 'reject'};
//  - a plan waiting for approval (auto-plan or manual) with trips: Plans('…')/Lodestar.Approve {note}; one without
//    trips (older capacity-only auto-plan) cannot go live and the approve button stays disabled.
// A plan or draft with rule violations needs a reason to override them: the note becomes required and is also sent
// as overrideReason (the API refuses the approval without one, OverrideReasonRequired).
// On success the design's link continues to the loaders' Lodestar Dock (the cross-device notice).
// The figures (orders to approve, deferrals, protected outlets kept) come from what is approved (approvalFigures), not
// from the day's deferral records, which also hold earlier runs' deferrals (yesterday's, of an order now protected).
import { useState } from 'react';
import { useScreenNav } from '@/components/ScreenShell';
import Btn from '@/components/live/Btn';
import { Lane, tripTwoHead, useBoardCards } from '@/components/live/board';
import { PlanSide, useCount } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { PLAN_EVENTS, useReviewRun, usePlanScope } from '@/components/live/plan-data';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { approvalFigures } from '@/components/live/approval';
import { useAuth } from '@/lib/auth/AuthProvider';
import { dayFilter, fmtClock, fmtDayTime, fmtRunDate, fmtTime, isoDay, title } from '@/lib/format';
import { useAction, useQuery } from '@/lib/odata/hooks';
import type { AgentRun, AgentRunDetail, Order, Plan } from '@/lib/odata/types';
import { depotFilter } from '@/lib/workday';
import { useDepots } from '@/components/live/depots';

function Check({ label, value, ok = true, testId }: { label: string; value: string; ok?: boolean; testId?: string }) {
  return (
    <div className="x-ck" style={{ minHeight: '36px', fontSize: '14px' }} data-testid={testId} data-ok={ok ? undefined : 'false'}>
      <span className="x-ck__i" style={ok ? undefined : { color: 'var(--st-exception-fg)' }}><Ic n={ok ? 'check' : 'alert'} /></span>
      <span className="x-ck__l" style={{ fontSize: '14px' }}>{label}</span>
      <span className="x-ck__v" style={{ fontSize: '13px' }}>{value}</span>
    </div>
  );
}

function Who({ icon, title: t, sub, items }: { icon: 'box' | 'truck' | 'store'; title: string; sub: string; items: string[] }) {
  return (
    <div className="dx-inset" style={{ flex: '1', minWidth: '0', gap: '12px', padding: '18px' }}>
      <div className="hstack" style={{ gap: '10px' }}>
        <span className="dx-lead" style={{ background: '#FFFFFF' }}><Ic n={icon} /></span>
        <div className="vstack" style={{ gap: '0' }}><b style={{ fontSize: '15px' }}>{t}</b><span className="dx-t13">{sub}</span></div>
      </div>
      {items.map(i => (
        <div key={i} className="hstack" style={{ gap: '8px', alignItems: 'flex-start', fontSize: '14px', lineHeight: '1.45', color: 'var(--text-2)' }}>
          <span className="x-ck__i" style={{ marginTop: '2px' }}><Ic n="check" /></span>
          <span>{i}</span>
        </div>
      ))}
    </div>
  );
}

function Approve({ onClose, framed = false }: { onClose?: () => void; framed?: boolean }) {
  const { name: depotName } = useDepots();
  const nav = useScreenNav();
  const { session } = useAuth();
  const scope = usePlanScope();
  const { runDate, plansFilter, tripsFilter, ordersFilter, active } = scope;
  const { runId, run, setRunId } = useReviewRun();
  const draft = run.data?.status === 'NEEDS_APPROVAL' ? run.data : null;
  const plans = useQuery<Plan[]>(plansFilter ? `approve-plans:${plansFilter}` : null, c =>
    c.all<Plan>('Plans', { filter: `${plansFilter} and status in ('NEEDS_APPROVAL','DRAFT')`, orderby: 'version desc' }),
  { refreshOn: PLAN_EVENTS });
  const pending = plans.data?.[0] ?? null;
  const board = useBoardCards({ draft: draft?.detail ?? null, tripsFilter, ordersFilter, active });
  const total = useCount('Orders', ordersFilter ? `${ordersFilter} and status ne 'CANCELLED'` : null);
  const deferralFilter = runDate ? [dayFilter('order/runDate', runDate), "status in ('SUGGESTED','CONFIRMED')", depotFilter('order/outlet/depot', active)].filter(Boolean).join(' and ') : null;
  const recorded = useCount('Deferrals', deferralFilter);
  // protected outlets (deferred on the previous run) must never be deferred again: the run date's protected orders
  const protectedOrders = useQuery<string[]>(ordersFilter ? `protected:${ordersFilter}` : null, async c =>
    (await c.all<Order>('Orders', { filter: `${ordersFilter} and deferredYesterday eq true and status ne 'CANCELLED'`, select: 'id' })).map(o => o.id),
  { refreshOn: PLAN_EVENTS });
  const [note, setNote] = useState('');
  const [done, setDone] = useState<string | null>(null);
  // what was approved stays on screen after it went live (the run then reads APPROVED, the plan PUBLISHED)
  const [approved, setApproved] = useState<AgentRunDetail | null>(null);
  const violations = (draft ? draft.detail?.violations : pending?.summary?.violations) ?? [];
  const needsReason = violations.length > 0 && !note.trim();
  // A plan approval puts its trips into effect; one stored without trips (an older capacity-only auto-plan) cannot
  // go live (the API answers 409 PlanNotExecutable), so it is not offered: draft the day with the agent instead.
  // The same holds for an agent draft without trips (it can still be rejected).
  const shownTrips = draft ? draft.detail?.plan?.trips : (pending?.summary as { plan?: { trips?: unknown[] } } | null | undefined)?.plan?.trips;
  const notExecutable = (!!draft || !!pending) && !(Array.isArray(shownTrips) && shownTrips.length > 0);

  const approveDraft = useAction<{ decision: 'approve' | 'reject' }, AgentRun>(
    (c, p) => c.action<AgentRun>('AgentRuns', runId!, 'Resume', {
      decision: p.decision, comment: note || undefined, overrideReason: p.decision === 'approve' && violations.length ? note.trim() : undefined,
    }),
    {
      onSuccess: (r, p) => {
        void run.refresh();
        if (p.decision === 'approve') {
          setApproved(draft?.detail ?? null);
          setDone(r.planId ? `Plan ${r.planId} is live` : 'The draft is approved');
          nav.go('L5');
        } else {
          setRunId(null);
          setDone('Draft rejected. Nothing went live.');
        }
      },
    },
  );
  const approvePlan = useAction<Plan, Plan>((c, p) => c.action<Plan>('Plans', p.id, 'Approve', { note: note || undefined, overrideReason: violations.length ? note.trim() : undefined }), {
    onSuccess: p => {
      setApproved((pending?.summary as AgentRunDetail | null | undefined) ?? null);
      void plans.refresh();
      setDone(`Plan ${p.id} is live`);
      nav.go('L5');
    },
  });

  const target = draft ? 'draft' : pending ? 'plan' : null;
  const figures = approvalFigures(draft?.detail ?? (pending?.summary as AgentRunDetail | null | undefined) ?? approved, protectedOrders.data ?? []);
  const deferred = figures ? figures.deferred : recorded;
  const deferredOutlets = figures ? figures.deferredOutlets : recorded;
  const protectedDeferred = figures && protectedOrders.data ? figures.protectedDeferred : undefined;
  const toApprove = figures?.planned ?? total;
  const version = draft ? draft.detail?.plan?.version ?? draft.detail?.version : pending?.version;
  const rules = draft?.detail?.ruleChecks ?? [];
  const failing = rules.filter(r => !r.passed);
  const review = draft?.detail?.needsReview ?? [];
  const vehicles = board.lanes.length;
  const firstDepart = board.cards.map(c => c.departs).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))[0];
  const depotLine = active.map(d => depotName(d)).join(' + ');
  const busy = approveDraft.pending || approvePlan.pending;
  const error = approveDraft.error ?? approvePlan.error;
  const approve = () => (draft ? void approveDraft.run({ decision: 'approve' }) : pending ? void approvePlan.run(pending) : undefined);

  const dialog = (
    <>
      <div className="dx-scrim" onClick={onClose} />
      <div className="dx-modal" style={{ left: '270px', top: '118px', width: '900px' }} role="dialog" aria-modal="true" aria-labelledby="approve-title">
        <div className="dx-modal__head">
          <div className="vstack" style={{ gap: '6px', flex: '1' }}>
            <span className="d-eyebrow">
              {target ? `Plan v${version ?? ''} · ${draft ? 'drafted by planning agent' : `${title(pending!.source)} plan`} · ${runDate ? fmtRunDate(runDate) : ''} run · ${depotLine}` : depotLine}
            </span>
            <span className="dx-h1xl" id="approve-title">
              {done ?? (target ? `Approve ${toApprove ?? '…'} orders and go live` : 'Nothing is waiting for approval')}
            </span>
            <span className="dx-t14">
              Approver <b style={{ color: 'var(--text)' }}>{session?.name}</b> · {fmtDayTime(new Date())}
              {draft ? ` · ${depotName(draft.depot)} ${isoDay(draft.runDate)}` : ''} · {vehicles} vehicles.
            </span>
          </div>
          <span className="dx-close" data-lk="C"><Ic n="x" /></span>
        </div>
        <div className="dx-modal__body">
          {(run.error || plans.error) && <ErrorBanner error={run.error ?? plans.error} onRetry={() => { void run.refresh(); void plans.refresh(); }} />}
          {!target && !done && plans.data && (
            <Empty title="Nothing to approve" text="There is no agent draft or plan waiting for approval for this run date." icon="check" />
          )}
          {(target || done) && (
            <>
              <div className="hstack" style={{ gap: '14px', alignItems: 'stretch' }}>
                <Who icon="box" title="Docks" sub="Loaders, Lodestar Dock" items={[`Load sheets for ${vehicles} vehicles`, `Loading order by departure${firstDepart ? `, first at ${fmtClock(firstDepart)}` : ''}`, 'Chilled lines marked for reefers only']} />
                <Who icon="truck" title="Drivers" sub="Lodestar Run" items={[`${board.cards.length} trips download and work offline`, 'Stops in sequence with windows and access notes', 'Seal and reefer checks before departure']} />
                <Who icon="store" title="Stores" sub="Lodestar Store" items={['Arrival window for every order', `${deferredOutlets ?? '…'} deferred outlet${deferredOutlets === 1 ? '' : 's'} told why and the new date`]} />
              </div>
              <div className="hstack" style={{ gap: '24px', alignItems: 'flex-start' }}>
                <div className="vstack" style={{ gap: '0', flex: '1', minWidth: '0' }}>
                  <div className="dx-sech" style={{ marginBottom: '4px' }}><b>{"Checks"}</b></div>
                  {draft ? (
                    <Check label={failing.length ? `${failing.length} hard rule(s) still failing` : 'All hard rules pass'} value={`${rules.length - failing.length} / ${rules.length}`} ok={!failing.length} />
                  ) : (
                    <Check label={violations.length ? `${violations.length} rule violation(s) in the plan` : 'Plan checked by the planner'} value={pending ? title(pending.source) : ''} ok={!violations.length} />
                  )}
                  {notExecutable && (
                    <Check label={draft ? 'This draft has no trips to put into effect: reject it or re-draft' : 'This plan has no trips to put into effect: draft the day with the planning agent'} value="cannot go live" ok={false} />
                  )}
                  <Check label="Deferrals with a reason code" value={`${deferred ?? '…'}`} />
                  <Check label="Orders to review" value={review.length ? `${review.length} open` : 'none'} ok={!review.length} />
                  <Check label="Protected outlets kept" testId="protected-check"
                    value={!figures ? '…' : protectedDeferred === undefined ? '…' : protectedDeferred ? `${protectedDeferred} not on a trip` : figures.protectedKept ? `${figures.protectedKept} kept, never deferred` : 'never deferred'}
                    ok={!protectedDeferred} />
                  {violations.length > 0 && (
                    <ul className="dx-t14" data-testid="violations" style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                      {violations.map((v, i) => {
                        const x = v as { rule?: string; detail?: string };
                        return <li key={i}>{x.detail ?? x.rule ?? 'rule violation'}</li>;
                      })}
                    </ul>
                  )}
                  <div className="dx-field" style={{ marginTop: '10px' }}>
                    <span className="dx-label">{violations.length ? 'Reason to override the rule violations (required)' : 'Note for the log (optional)'}</span>
                    <div className="dx-input"><input className="lv-input" aria-label={violations.length ? 'Override reason' : 'Approval note'} value={note} onChange={e => setNote(e.target.value)} placeholder="Why you approve, or what you changed" /></div>
                  </div>
                </div>
                <div className="dx-inset dx-inset--info" style={{ width: '340px', flexShrink: '0' }} data-lk="L161">
                  <div className="hstack" style={{ gap: '8px', fontSize: '14px', fontWeight: '800', color: 'var(--st-enroute-fg)' }}><Ic n="info" className="ic ic--sm" />{"After you approve"}</div>
                  <span className="dx-t14">
                    <b style={{ color: 'var(--text)' }}>{"The agent cannot publish on its own."}</b>
                    {` Any later change, yours or the agent's, is a ${version ? `v${version + 1}` : 'new'} draft that needs your approval, and only the people it touches are told.`}
                  </span>
                </div>
              </div>
              <ErrorBanner error={error} />
            </>
          )}
        </div>
        <div className="dx-modal__foot">
          <span className="dx-t13">Your name and the time are logged in the audit chain.</span>
          <span className="spacer" />
          {draft && !done && (
            <Btn className="d-btn d-btn--ghost" testId="reject-draft" busy={approveDraft.pending} onClick={() => void approveDraft.run({ decision: 'reject' })}>{"Reject draft"}</Btn>
          )}
          <span className="d-btn d-btn--ghost" data-lk="C">{"Not yet"}</span>
          <Btn className="d-btn d-btn--primary" testId="approve" busy={busy} disabled={!target || Boolean(done) || needsReason || notExecutable} onClick={approve}>
            <Ic n="check" />{done ? 'Live' : 'Approve & go live'}
          </Btn>
        </div>
      </div>
    </>
  );
  if (!framed) return dialog;
  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-12 Approve and go live · desktop">
      <div className="d-app">
        <PlanSide active="N2" />
        <div className="d-main" style={{ flexDirection: 'row', gap: '20px' }}>
          <div className="x-col" style={{ flex: '1', gap: '16px' }}>
            <div className="d-head">
              <div className="d-head__txt">
                <div className="d-eyebrow">
                  {draft ? 'Draft by planning agent ' : pending ? `${title(pending.source)} plan ` : 'Plan '}
                  <span className="m-sep" />{version ? ` v${version} ` : ' '}<span className="m-sep" />
                  <span className={`m-tag ${target ? 'm-tag--warn' : 'm-tag--ok'}`}><span className="dot" />{target ? 'waiting for your approval' : 'nothing waiting'}</span>
                </div>
                <div className="d-h1">Plan for {runDate ? fmtRunDate(runDate) : '…'}</div>
              </div>
            </div>
            <div className="x-board">
              <div className="x-lanehead">
                <span style={{ width: '168px' }}>{"Vehicle · minutes"}</span>
                <span style={{ flex: '1' }}>Trip 1{firstDepart ? ` · departs ${fmtTime(firstDepart)}` : ''}</span>
                <span style={{ flex: '1' }}>{tripTwoHead(board.limits)}</span>
              </div>
              {board.loading && <Skeleton rows={3} />}
              {board.lanes.slice(0, 6).map(([id, cs]) => <Lane key={id} vehicleId={id} cards={cs} v={board.vehicles.get(id)} limits={board.limits} />)}
            </div>
          </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}

/** The approve and go live dialog over the page it was opened from (OverlayHost); its own route shows it over the plan board. */
export function ApproveDialog({ onClose }: { onClose?: () => void }) {
  return <Approve onClose={onClose} />;
}

export default function LiveDsp12ApproveAndGoLive() {
  return <Approve framed />;
}
