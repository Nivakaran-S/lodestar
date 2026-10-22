import { createHash } from 'crypto';
import { Logger } from '@nestjs/common';
import { ServiceTokenClient } from './service-token.client';

export type AuditOutcome = 'SUCCESS' | 'FAILED' | 'DENIED';

/** One write, as reported by the service that performed it. */
export interface AuditEvent {
  at: string; // ISO timestamp
  actor: string; // token subject
  actorRoles: string[];
  client?: string; // azp of the caller's token
  action: string; // Plans.Approve, Orders.Create, PATCH /odata/v4/Orders('…')
  entitySet?: string;
  entityKey?: string;
  outcome: AuditOutcome;
  payload?: unknown;
}

/** Where audit events go. Services send them to the audit service; the audit service writes locally. */
export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export const AUDIT_SINK = Symbol('AUDIT_SINK');

const MAX_PENDING = 1000;
const RETRY_EVERY_MS = 5_000;
const REQUEST_TIMEOUT_MS = 3_000;

/**
 * Sends audit events to the audit service (POST /odata/v4/AuditEntries) with
 * this service's client-credentials token. If the audit service is briefly
 * unreachable, events are kept in a bounded in-memory queue and retried in
 * order, so a write is never lost silently and never blocks for long.
 */
export class HttpAuditSink implements AuditSink {
  private readonly logger = new Logger(HttpAuditSink.name);
  private readonly pending: AuditEvent[] = [];
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly auditUrl: string,
    private readonly tokens: ServiceTokenClient,
  ) {}

  get queued(): number {
    return this.pending.length;
  }

  async record(event: AuditEvent): Promise<void> {
    // Keep ordering: if older events are waiting, queue behind them.
    if (this.pending.length === 0 && (await this.send(event))) return;
    this.enqueue(event);
  }

  /** Retries queued events in order; stops at the first failure. */
  async flush(): Promise<void> {
    while (this.pending.length) {
      if (!(await this.send(this.pending[0]))) return;
      this.pending.shift();
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private enqueue(event: AuditEvent) {
    if (this.pending.length >= MAX_PENDING) {
      const dropped = this.pending.shift();
      this.logger.error(`Audit queue full; dropped oldest event ${dropped?.action} at ${dropped?.at}`);
    }
    this.pending.push(event);
    if (!this.timer) {
      this.timer = setInterval(() => void this.flush().then(() => !this.pending.length && this.stop()), RETRY_EVERY_MS);
      this.timer.unref?.();
    }
  }

  private async send(event: AuditEvent): Promise<boolean> {
    if (!this.auditUrl) {
      this.logger.error(`Audit not configured (AUDIT_URL): ${event.action} by ${event.actor} → ${event.outcome}`);
      return true;
    }
    if (!this.tokens.configured) {
      this.logger.warn(`Audit (no service credentials configured): ${event.action} by ${event.actor} → ${event.outcome}`);
      return true;
    }
    try {
      const res = await this.tokens.fetch(`${this.auditUrl.replace(/\/$/, '')}/odata/v4/AuditEntries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return true;
      this.logger.warn(`Audit service answered HTTP ${res.status} for ${event.action}`);
      return false;
    } catch (err) {
      this.logger.warn(`Audit service unreachable (${(err as Error).message}); queued ${event.action}`);
      return false;
    }
  }
}

// csv: uploaded reference files (ADM-14) are never copied into the audit log, only their SHA-256.
// pin: a Dock PIN (Users.SetDockPin) is never copied either.
const REDACT = /pass(word)?|secret|token|signature|authorization|photo(data|base64)|^csv$|^(dock_?)?pin$/i;
/** Redacted keys that hold a guessable secret (not just bulk): the body hash must not cover their value. */
const GUESSABLE = /pass(word)?|secret|token|authorization|^(dock_?)?pin$/i;
const MAX_PAYLOAD_CHARS = 4096;

/** Removes secrets and bulky fields from a request body before it is audited; `hit.redacted` says whether a secret was. */
export function redact(value: unknown, depth = 0, hit?: { redacted: boolean }): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1, hit));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT.test(k)) {
      out[k] = '[redacted]';
      if (hit && GUESSABLE.test(k)) hit.redacted = true;
    } else out[k] = redact(v, depth + 1, hit);
  }
  return out;
}

/**
 * Audit payload for a request body: a SHA-256 of the full body plus a redacted, size-capped copy. When a
 * guessable secret was redacted the hash is of the redacted body (marked bodyRedacted): a hash of a body holding a
 * 4-digit PIN or a short password could be reversed by trying every value. Bulky fields (csv, photos) keep the
 * full-body hash.
 */
export function auditPayload(body: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const hit = { redacted: false };
  const copy = redact(body, 0, hit);
  const redacted = JSON.stringify(copy ?? null);
  const raw = body === undefined ? '' : hit.redacted ? redacted : JSON.stringify(body);
  return {
    ...extra,
    bodySha256: createHash('sha256').update(raw).digest('hex'),
    ...(hit.redacted ? { bodyRedacted: true } : {}),
    body: redacted.length > MAX_PAYLOAD_CHARS ? { truncated: true, preview: redacted.slice(0, MAX_PAYLOAD_CHARS) } : copy,
  };
}
