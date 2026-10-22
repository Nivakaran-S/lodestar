import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ODataError } from '@lodestar/odata';

/** A run view as returned by the agent service (PLATFORM.md §4). */
export interface AgentRunSnapshot {
  id: string;
  status: string; // DRAFTING | NEEDS_APPROVAL | APPROVED | REJECTED | FAILED
  depot?: string;
  runDate?: string;
  plan?: Record<string, unknown>;
  explanation?: unknown;
  [key: string]: unknown;
}

/** A full draft of a busy day on a small VM can take a while: wait up to two minutes (the gateway allows 150 s). */
export const AGENT_TIMEOUT_MS = 120_000;

/** Optional DI token to replace fetch (tests). */
export const AGENT_FETCH = Symbol('AGENT_FETCH');

/**
 * Client of the planning agent (LangGraph, backend/apps/agent).
 *
 * The agent has no service bypass: every call carries the *dispatcher's own*
 * bearer token, so the agent applies its own RBAC (dispatcher) and depot ABAC
 * to the human who asked.
 *
 *   POST /runs {depot, runDate}                     → run view
 *   GET  /runs/{id}                                 → run view
 *   POST /runs/{id}/resume {decision, edits?, comment?}
 *   POST /runs/{id}/revise {edits, version, lockedOrderIds, lockedTrips, comment?}  → a new draft run (next version)
 *   POST /ask {runId, question}
 *   GET  /config                                    → model, fallback, guardrails (read-only)
 */
@Injectable()
export class AgentClient {
  private readonly logger = new Logger(AgentClient.name);
  // the agent's address comes from configuration (AGENT_URL), never from code
  private readonly baseUrl = (process.env.AGENT_URL ?? '').replace(/\/$/, '');

  constructor(@Optional() @Inject(AGENT_FETCH) private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {}

  startRun(depot: string, runDate: string, authorization: string) {
    return this.call<AgentRunSnapshot>('POST', '/runs', authorization, { depot, runDate });
  }

  getRun(id: string, authorization: string) {
    return this.call<AgentRunSnapshot>('GET', `/runs/${encodeURIComponent(id)}`, authorization);
  }

  resume(id: string, authorization: string, decision: string, edits?: unknown[], comment?: string) {
    const body: Record<string, unknown> = { decision };
    if (edits !== undefined) body.edits = edits;
    if (comment !== undefined) body.comment = comment;
    return this.call<AgentRunSnapshot>('POST', `/runs/${encodeURIComponent(id)}/resume`, authorization, body);
  }

  /** A change to an approved run: the agent starts a new draft run seeded from its plan plus the edits. */
  reviseRun(id: string, authorization: string, body: { edits: unknown[]; version: number; lockedOrderIds: string[]; lockedTrips: { vehicleId: string; tripNo: number }[]; comment?: string }) {
    return this.call<AgentRunSnapshot>('POST', `/runs/${encodeURIComponent(id)}/revise`, authorization, body);
  }

  ask(runId: string, question: string, authorization: string) {
    return this.call<Record<string, unknown>>('POST', '/ask', authorization, { runId, question });
  }

  /** The agent's model, fallback and guardrails (DSP-16, ADM-17). Read-only; dispatcher or admin token. */
  config(authorization: string) {
    return this.call<Record<string, unknown>>('GET', '/config', authorization);
  }

  private async call<T>(method: string, path: string, authorization: string, body?: unknown): Promise<T> {
    if (!authorization) throw ODataError.forbidden('The planning agent needs the calling dispatcher’s token');
    if (!this.baseUrl) throw new ODataError(503, 'ServiceUnavailable', 'The planning agent is not configured (AGENT_URL)');
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: authorization,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(`Agent ${method} ${path} failed: ${(err as Error).message}`);
      throw transportError(err as Error);
    }
    if (res.ok) return (await res.json()) as T;
    throw responseError(res.status, await res.text().catch(() => ''));
  }
}

/** Maps a failed fetch (no HTTP answer) to the OData error the gateway returns. */
function transportError(err: Error): ODataError {
  if (err.name === 'TimeoutError') {
    return new ODataError(504, 'AgentTimeout', `The planning agent did not answer within ${AGENT_TIMEOUT_MS / 1000} s; the draft may still be running, try again in a moment`);
  }
  return new ODataError(503, 'ServiceUnavailable', 'The planning agent is not reachable');
}

/** The agent's own error message from a response body (JSON error/detail, else the raw text). */
function agentMessage(detail: string): string {
  let message = detail.slice(0, 300);
  try {
    const parsed = JSON.parse(detail);
    message = parsed?.error?.message ?? parsed?.detail ?? message;
  } catch {
    /* not JSON */
  }
  return message;
}

/** Maps a non-2xx agent response to the OData error the gateway returns. */
function responseError(status: number, detail: string): ODataError {
  const message = agentMessage(detail);
  if (status === 401 || status === 403) return new ODataError(status, status === 401 ? 'Unauthorized' : 'Forbidden', `Planning agent: ${message || 'access denied'}`);
  if (status === 404) return ODataError.notFound('The planning agent does not know this run');
  if (status === 409 || status === 400 || status === 422) {
    return ODataError.conflict(`The planning agent rejected the request${message ? `: ${message}` : ''}`);
  }
  return new ODataError(502, 'BadGateway', `The planning agent answered HTTP ${status}`);
}
