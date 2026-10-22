'use client';
// "Ask the planning agent" panel (DSP-39, DSP-40), from the design's ag-panel markup.
// Questions go to AgentRuns('…')/Lodestar.Ask {question}; the agent answers from the run's snapshot and may
// propose an edit. A proposal is applied to the draft with AgentRuns('…')/Lodestar.Resume {decision: 'edit',
// edits} (a new draft version, still waiting for a human); it never goes live from here. On a run already approved
// (its plan is live) the same call makes planning start the next version (v2…) as a new run seeded from the live plan
// plus the edits, with started trips locked: this tab then follows that new draft, which goes to DSP-12 for approval.
// The conversation is kept per run for this tab (sessionStorage), so DSP-39 and DSP-40 share it.
import { useCallback, useState, useSyncExternalStore } from 'react';
import { useScreenNav } from '@/components/ScreenShell';
import { fmtTime } from '@/lib/format';
import { useAction } from '@/lib/odata/hooks';
import { valueOf } from '@/lib/odata/client';
import { useAgentRunId } from '@/lib/workday';
import type { AgentAnswer, AgentRun } from '@/lib/odata/types';
import Btn from './Btn';
import { Ic } from './icons';
import { ErrorBanner, Spinner } from './states';

export interface ChatTurn {
  q: string;
  a?: AgentAnswer;
  at: string;
}

const listeners = new Set<() => void>();
const keyOf = (runId: string) => `lodestar.ask.${runId}`;
const cache = new Map<string, { raw: string | null; turns: ChatTurn[] }>();

function readTurns(runId: string): ChatTurn[] {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(keyOf(runId));
  } catch {
    raw = null;
  }
  const hit = cache.get(runId);
  if (hit && hit.raw === raw) return hit.turns;
  let turns: ChatTurn[] = [];
  try {
    turns = raw ? (JSON.parse(raw) as ChatTurn[]) : [];
  } catch {
    turns = [];
  }
  cache.set(runId, { raw, turns });
  return turns;
}

function writeTurns(runId: string, turns: ChatTurn[]) {
  try {
    window.sessionStorage.setItem(keyOf(runId), JSON.stringify(turns.slice(-20)));
  } catch {
    // storage blocked: the conversation lasts until reload
  }
  listeners.forEach(l => l());
}

const EMPTY: ChatTurn[] = [];

export function useAgentChat(runId: string | null) {
  const turns = useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (runId ? readTurns(runId) : EMPTY),
    () => EMPTY,
  );
  const set = useCallback((t: ChatTurn[]) => runId && writeTurns(runId, t), [runId]);
  return [turns, set] as const;
}

/** The latest proposal in the conversation, if any. */
export function latestProposal(turns: ChatTurn[]) {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].a?.proposal?.edits?.length) return { turn: turns[i], index: i };
  return null;
}

/** A proposal's rule checks two per row (the design's ag-rrow), failing rules first. */
export function rulePairs<T extends { passed: boolean }>(checks: T[]): T[][] {
  const sorted = [...checks.filter(c => !c.passed), ...checks.filter(c => c.passed)];
  const rows: T[][] = [];
  for (let i = 0; i < sorted.length; i += 2) rows.push(sorted.slice(i, i + 2));
  return rows;
}

const SUGGESTIONS = ['Why are these orders deferred?', 'Which rules are closest to failing?', 'What if the busiest reefer fails its check?'];

function Answer({ t }: { t: ChatTurn }) {
  if (!t.a) return <div className="ag-a"><Spinner label="The agent is reading the draft…" /></div>;
  const lines = t.a.answer.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const [lede, ...rest] = lines;
  return (
    <div className="ag-a">
      <span className="ag-who"><Ic n="sparkle-plus" />Planning agent · {fmtTime(t.at)} · read the draft</span>
      <div className="ag-lede">{lede}</div>
      {rest.map((p, i) => (
        <div key={i} className="ag-pt">
          <span className="ag-pt__n">{i + 1}</span>
          <div className="ag-pt__c"><span>{p.replace(/^[-•]\s*/, '')}</span></div>
        </div>
      ))}
      {t.a.toolCalls?.length ? (
        <div className="ag-srcs">{t.a.toolCalls.map((c, i) => <span key={i} className="ag-src">{(typeof c === 'string' ? c : c.name).replace(/_/g, ' ')}</span>)}</div>
      ) : null}
    </div>
  );
}

/** The draft version a proposal becomes: the live plan's next version on an approved run, else the agent's own. */
export function proposalVersion(run: Pick<AgentRun, 'status'>, draftVersion: number | undefined, liveVersion: number | undefined) {
  return run.status === 'APPROVED' && liveVersion ? liveVersion + 1 : draftVersion;
}

export default function AskAgent({ run, mode, subtitle, liveVersion }: { run: AgentRun; mode: 'ask' | 'proposal'; subtitle: string; liveVersion?: number }) {
  const nav = useScreenNav();
  const [, setRunId] = useAgentRunId();
  const [turns, setTurns] = useAgentChat(run.id);
  const [text, setText] = useState('');
  const proposal = latestProposal(turns);

  const ask = useAction<string, AgentAnswer>(
    async (c, question) => valueOf<AgentAnswer>(await c.action('AgentRuns', run.id, 'Ask', { question })),
    {
      onSuccess: (a, q) => {
        const next = [...turns.filter(t => t.a || t.q !== q), { q, a, at: new Date().toISOString() }];
        setTurns(next);
        if (a.proposal?.edits?.length && mode === 'ask') nav.go('L55');
      },
    },
  );
  const apply = useAction<void, AgentRun>(
    c => c.action<AgentRun>('AgentRuns', run.id, 'Resume', { decision: 'edit', edits: proposal!.turn.a!.proposal!.edits, comment: proposal!.turn.q.slice(0, 500) }),
    {
      onSuccess: r => {
        setTurns(turns.map((t, i) => (i === proposal!.index ? { ...t, a: { ...t.a!, proposal: null } } : t)));
        // a change to a live plan comes back as a new draft run (the next version): follow it to the approval
        if (r?.id && r.id !== run.id) setRunId(r.id);
        nav.go('L159');
      },
    },
  );
  const dismiss = () => {
    if (proposal) setTurns(turns.map((t, i) => (i === proposal.index ? { ...t, a: { ...t.a!, proposal: null } } : t)));
    nav.go('L160');
  };
  const send = (q: string) => {
    const question = q.trim();
    if (!question || ask.pending) return;
    setText('');
    void ask.run(question);
  };

  const shown = mode === 'proposal' && proposal ? [proposal.turn] : turns;
  const pending = ask.pending ? [{ q: '…', at: new Date().toISOString() } as ChatTurn] : [];

  return (
    <div className="ag-panel" data-testid="ask-agent">
      <div className="ag-head">
        <span className="ag-lead"><Ic n="sparkle-plus" /></span>
        <div className="ag-head__t"><b>{"Ask the planning agent"}</b><span>{subtitle}</span></div>
        <span className="ag-x" data-lk="C"><Ic n="x" /></span>
      </div>
      <div className="ag-body" style={mode === 'proposal' ? { gap: '12px' } : undefined}>
        {shown.length === 0 && !ask.pending && (
          <div className="ag-a"><span className="ag-who"><Ic n="sparkle-plus" />{"Planning agent"}</span><div className="ag-lede">Ask why it planned something, or what would change if you moved an order.</div></div>
        )}
        {shown.map((t, i) => (
          <div key={i} className="vstack" style={{ gap: '10px' }}>
            <div className="ag-q"><div className="ag-q__b">{t.q}</div></div>
            <Answer t={t} />
            {mode === 'proposal' && t.a?.proposal && (
              <div className="ag-prop" data-testid="proposal">
                <div className="ag-prop__h"><Ic n="sparkle-plus" />{"Proposal for the draft"}</div>
                <div className="ag-prop__t">{t.a.proposal.edits.length} change{t.a.proposal.edits.length === 1 ? '' : 's'} to the {run.status === 'APPROVED' ? 'live plan, as a new draft' : 'draft'}</div>
                <div className="vstack" style={{ gap: '5px' }}>
                  {t.a.proposal.edits.map((e, j) => (
                    <div key={j} className="ag-mv">
                      <b className="id">{String(e.orderId ?? '')}</b>
                      <span>{String(e.op ?? 'edit')}</span>
                      <Ic n="arrow-right" />
                      <b>{e.op === 'defer' ? `Deferred · ${String(e.reason ?? '')}` : `${String(e.vehicleId ?? '')}${e.tripNo ? ` Trip ${String(e.tripNo)}` : ''}`}</b>
                    </div>
                  ))}
                </div>
                {t.a.proposal.ruleChecks?.length ? (
                  <div className="ag-rules" data-testid="proposal-rules">
                    {/* two per row as designed (ag-rrow), the failing rules first */}
                    {rulePairs(t.a.proposal.ruleChecks).map((pair, k) => (
                      <div key={k} className="ag-rrow">
                        {pair.map(r => (
                          <div key={r.rule} className="ag-rule" title={r.label} data-failed={r.passed ? undefined : true}>
                            <span style={{ display: 'inline-flex', color: r.passed ? undefined : 'var(--st-exception-fg)' }}><Ic n={r.passed ? 'check' : 'alert'} /></span>
                            <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', ...(r.passed ? {} : { color: 'var(--st-exception-fg)' }) }}>{r.label}</b>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="ag-acts">
                  <Btn className="d-btn d-btn--primary" testId="apply-proposal" busy={apply.pending} onClick={() => void apply.run()}><Ic n="check" />{"Apply to draft"}</Btn>
                  <Btn className="d-btn" testId="dismiss-proposal" onClick={dismiss}>{"Dismiss"}</Btn>
                  <span className="spacer" />
                  <span className="m-pill m-pill--brand" style={{ height: '26px', padding: '0 10px', fontSize: '12px' }}>Draft v{proposalVersion(run, t.a.proposal.draftVersion, liveVersion) ?? '…'} · not live</span>
                </div>
                <div className="ag-audit"><Ic n="history" /><span>Logs <b>Proposed by planning agent · applied by you</b></span></div>
              </div>
            )}
          </div>
        ))}
        {pending.map((t, i) => <Answer key={`p${i}`} t={t} />)}
        <ErrorBanner error={ask.error ?? apply.error} compact />
        {mode === 'ask' && (
          <>
            <div className="spacer" />
            <div className="ag-sugg">
              <span className="ag-who" style={{ color: 'var(--text-3)' }}>{"Ask next"}</span>
              {SUGGESTIONS.map(s => (
                <Btn key={s} className="ag-chip" onClick={() => send(s)}><Ic n="corner-down-right" />{s}</Btn>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="ag-foot">
        <div className="ag-guard"><Ic n="lock" /><span>{"Explains and proposes. Changes go to the draft; only you can approve and go live."}</span></div>
        <form className="ag-input" onSubmit={e => { e.preventDefault(); send(text); }}>
          <input className="lv-input ag-input__t" aria-label="Ask about this plan" placeholder="Ask about this plan…" value={text} maxLength={2000} onChange={e => setText(e.target.value)} />
          <Btn className="ag-send" testId="ask-send" busy={ask.pending} disabled={!text.trim()} onClick={() => send(text)}><Ic n="send" /></Btn>
        </form>
      </div>
    </div>
  );
}
