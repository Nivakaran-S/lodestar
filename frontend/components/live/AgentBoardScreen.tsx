'use client';
// Shared body of DSP-39 (Ask the planning agent) and DSP-40 (Agent proposal in draft): the draft board on the
// left (design class ag-board), the ask panel on the right. Without a run under review it offers to start one.
// A run already approved shows its live plan (the Plans version it became), not a draft: a change to it is applied as
// the next version's draft (AskAgent), and the header's primary action is no longer reviewing the draft's deferrals.
import { useRouter } from 'next/navigation';
import Btn from './Btn';
import AskAgent from './AskAgent';
import { idleSummary, Lane, tripTwoHead, useBoardCards } from './board';
import { PlanSide } from './chrome';
import { Ic } from './icons';
import { useLiveRun, useReviewRun, usePlanScope, useRunPlan, useStartAgentRun } from './plan-data';
import { Empty, ErrorBanner, Skeleton } from './states';
import { fmtNum, fmtRunDate, fmtTime } from '@/lib/format';
import { useDepots } from './depots';
import { openOverlay } from '@/lib/overlay';

export default function AgentBoardScreen({ name, mode }: { name: string; mode: 'ask' | 'proposal' }) {
  const { name: depotName } = useDepots();
  const router = useRouter();
  const scope = usePlanScope();
  const review = useReviewRun();
  // no draft under review: the day's live plan, so a change to it can still be asked for (it becomes the next draft)
  const live = useLiveRun(!review.runId && !review.loading);
  const { setRunId } = review;
  const runId = review.runId ?? live.runId;
  const run = review.runId ? review.run : live.run;
  const start = useStartAgentRun(r => setRunId(r.id));
  const detail = run.data?.detail ?? null;
  const board = useBoardCards({ draft: detail, tripsFilter: scope.tripsFilter, ordersFilter: scope.ordersFilter, active: scope.active });
  const deferrals = detail?.deferrals ?? [];
  const runPlan = useRunPlan(run.data);
  const approved = run.data?.status === 'APPROVED';
  // an approved run is the plan it became (PLK-…-v1), whose version can differ from the agent's draft count
  const version = (approved ? runPlan.version : undefined) ?? detail?.plan?.version ?? detail?.version;
  const depot = run.data?.depot ?? scope.depot ?? scope.active[0];
  const waiting = run.data?.status === 'NEEDS_APPROVAL';
  const state = !run.data ? 'no draft'
    : waiting ? 'waiting for your approval'
      : approved ? (runPlan.live ? 'approved · live' : `approved · ${String(runPlan.status ?? 'replaced').toLowerCase()}`)
        : run.data.status.toLowerCase().replace('_', ' ');
  const kind = approved ? 'Plan' : 'Draft';
  const firstDepart = board.cards.map(c => c.departs).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))[0];

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name={name}>
      <div className="d-app">
        <PlanSide active="N2" />
        <div className="d-main" style={{ gap: '16px' }}>
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {`${kind} by planning agent `}<span className="m-sep" />{version ? ` v${version} ` : ' '}<span className="m-sep" />
                <span className={`m-tag ${waiting ? 'm-tag--warn' : 'm-tag--ok'}`} data-testid="run-state"><span className="dot" />{state}</span>
              </div>
              <div className="d-h1">Plan for {scope.runDate ? fmtRunDate(scope.runDate) : '…'}</div>
            </div>
            <span className="d-btn ag-btn-on" data-lk={mode === 'proposal' ? 'L160' : undefined} aria-current={mode === 'proposal' ? undefined : 'page'} aria-disabled={mode === 'proposal' ? undefined : true}><Ic n="sparkle-plus" />{"Ask the agent"}</span>
            <Btn className={`d-btn${waiting ? '' : ' d-btn--disabled'}`} disabled={!waiting} onClick={() => openOverlay('/plan/dsp-12-approve-and-go-live')}><Ic n="lock" />{"Approve & go live"}</Btn>
            {/* the draft's deferrals are decided before approval; once live they are on the plan board and the deferral log */}
            <Btn className={`d-btn${waiting ? ' d-btn--primary' : ''}`} onClick={() => router.push('/plan/dsp-03-deferral-decision')}><Ic n="history" />Review deferrals{waiting && deferrals.length ? ` (${deferrals.length})` : ''}</Btn>
          </div>
          <ErrorBanner error={run.error ?? start.error} onRetry={run.refresh} />
          {!runId && (
            <Empty title="No draft to ask about" text="Start the planning agent for this run date first." icon="sparkle-plus">
              <Btn className="d-btn d-btn--primary" testId="start-agent" busy={start.pending} disabled={!depot || !scope.runDate}
                onClick={() => void start.run({ depot: depot!, runDate: scope.runDate! })}>
                <Ic n="sparkle-plus" />Draft {depotName(depot)} with the agent
              </Btn>
            </Empty>
          )}
          {runId && (
            <div className="ag-split">
              <div className="ag-board">
                <div className="x-lanehead"><span style={{ width: '128px' }}>{"Vehicle · min"}</span><span style={{ flex: '1' }}>Trip 1{firstDepart ? ` · departs ${fmtTime(firstDepart)}` : ''}</span><span style={{ flex: '1' }}>{tripTwoHead(board.limits)}</span></div>
                {board.loading && <Skeleton rows={3} />}
                {board.lanes.slice(0, 5).map(([id, cs]) => <Lane key={id} vehicleId={id} cards={cs} v={board.vehicles.get(id)} limits={board.limits} />)}
                {deferrals.length > 0 && (
                  <div className="ag-defrow">
                    <div className="ag-deflabel"><b>{"Deferrals"}</b><span>{approved ? 'in the plan' : 'suggested'} · {fmtNum(deferrals.reduce((s, d) => s + d.m3, 0), 1)} m³</span></div>
                    {deferrals.slice(0, 3).map(d => (
                      <div key={d.orderId} className="ag-def ag-ref">
                        <div className="ag-def__main">
                          <span className="ag-def__t">{d.orderId}<span className="id" style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', fontWeight: '600', color: 'var(--text-2)' }}>{d.outletId}</span></span>
                          <span className="ag-def__m">{d.reason} · {fmtNum(d.m3, 1)} m³</span>
                        </div>
                        <div className="x-score"><b>{d.score}</b><span>{"score"}</span></div>
                      </div>
                    ))}
                  </div>
                )}
                {board.down.map(v => (
                  <div key={v.id} className="x-lane">
                    <div className="x-veh" style={{ padding: '0 2px', justifyContent: 'center' }}>
                      <div className="x-veh__id" style={{ color: 'var(--text-3)' }}>
                        <span className="x-veh__ic" style={{ opacity: '.55' }}><Ic n="truck" /></span>
                        <span className="id" style={{ textDecoration: 'line-through' }}>{v.id}</span>
                      </div>
                    </div>
                    <div className="x-down">
                      <Ic n="alert" className="ic ic--sm" />
                      <b>In workshop {scope.runDate ? fmtRunDate(scope.runDate) : ''}</b>
                      <span className="t-3">{v.tempClass === 'CHILLED' ? 'Reefer' : 'Dry'} {v.type === 'VAN' ? 'van' : 'truck'} · 0 trips</span>
                      <span className="spacer" />
                      <span className="x-code">{"VEH-DOWN"}</span>
                    </div>
                  </div>
                ))}
                <div className="spacer" />
                <div className="x-boardfoot"><Ic n="chevron-down" className="ic ic--sm" /><span>{idleSummary(board.idle)}</span></div>
              </div>
              {run.data ? (
                <AskAgent run={run.data} mode={mode} liveVersion={approved ? runPlan.version : undefined}
                  subtitle={`${approved ? (runPlan.live ? 'Live plan' : 'Plan') : 'Draft'} v${version ?? ''} · ${depotName(run.data.depot)} · ${scope.runDate ? fmtRunDate(scope.runDate) : ''}`} />
              ) : (
                <div className="ag-panel"><Skeleton rows={3} /></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
