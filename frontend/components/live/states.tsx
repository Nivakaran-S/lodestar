'use client';
// Loading, empty and error states for live screens, drawn with the design's tokens (skeleton cards, spinner,
// warning banner and empty card as on the DSP/ADM boards), so they look the same on every face.
import type { ReactNode } from 'react';
import type { ODataError } from '@/lib/odata/client';
import { Ic } from './icons';

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="lv-busy" role="status" aria-live="polite">
      <span className="lv-spin" aria-hidden />
      {label ?? 'Loading…'}
    </span>
  );
}

/** Skeleton rows in place of a list while it loads. */
export function Skeleton({ rows = 3, label = 'Loading live data…' }: { rows?: number; label?: string }) {
  return (
    <div className="lv-skelwrap" role="status" aria-live="polite" aria-label={label} data-state="loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="lv-skelcard">
          <span className="lv-skel" style={{ width: `${60 - i * 8}%` }} />
          <span className="lv-skel" style={{ width: `${35 + i * 6}%`, opacity: 0.7 }} />
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({ error, onRetry, compact }: { error: ODataError | Error | undefined; onRetry?: () => void; compact?: boolean }) {
  if (!error) return null;
  const e = error as ODataError;
  return (
    <div className={`lv-banner lv-banner--bad${compact ? ' lv-banner--compact' : ''}`} role="alert" data-state="error">
      <Ic n="alert" />
      <div className="lv-banner__txt">
        <b>{e.status === 403 ? 'Not allowed' : e.status === 0 && e.code !== 'ClientError' ? 'Lodestar is not reachable' : e.code === 'ClientError' ? 'Check and try again' : 'Something went wrong'}</b>
        <span>
          {e.message}
          {e.code && e.status ? <>{' '}<span className="lv-code">{e.code}</span></> : null}
        </span>
      </div>
      {onRetry && (
        <button type="button" className="d-btn d-btn--ghost lv-btn" onClick={ev => { ev.stopPropagation(); onRetry(); }}>
          <Ic n="refresh" />Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, text, icon = 'check', children }: { title: string; text?: ReactNode; icon?: Parameters<typeof Ic>[0]['n']; children?: ReactNode }) {
  return (
    <div className="lv-empty" data-state="empty">
      <span className="lv-empty__ic"><Ic n={icon} /></span>
      <b>{title}</b>
      {text && <span>{text}</span>}
      {children}
    </div>
  );
}

/**
 * The usual three-way render: skeleton while loading (first load only), error banner, empty card, else content.
 */
export function Loadable<T>({
  q,
  empty,
  rows,
  children,
}: {
  q: { data: T[] | undefined; loading: boolean; error: ODataError | undefined; refresh(): void };
  empty?: { title: string; text?: ReactNode };
  rows?: number;
  children: (data: T[]) => ReactNode;
}) {
  if (q.error && !q.data) return <ErrorBanner error={q.error} onRetry={q.refresh} />;
  if (!q.data) return <Skeleton rows={rows} />;
  if (q.data.length === 0 && empty) return <Empty title={empty.title} text={empty.text} />;
  return (
    <>
      {q.error && <ErrorBanner compact error={q.error} onRetry={q.refresh} />}
      {children(q.data)}
    </>
  );
}

/** A full-window state outside any face (gate, sign-in callback). */
export function GateScreen({ title, text, busy, action, link }: {
  title: string;
  text?: string;
  busy?: boolean;
  action?: { label: string; onClick: () => void };
  /** A full-page link (outside the Next app, e.g. the field app at /field/), shown first as the main way on. */
  link?: { label: string; href: string };
}) {
  return (
    <main className="lv-gate" data-state={busy ? 'loading' : 'notice'}>
      <div className="lv-gate__card">
        <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden>
          <rect width="32" height="32" rx="8" fill="#141B4D" />
          <path d="M16 4 L18.6 13.4 L28 16 L18.6 18.6 L16 28 L13.4 18.6 L4 16 L13.4 13.4 Z" fill="#F5B83D" />
        </svg>
        {busy && <span className="lv-spin" aria-hidden />}
        <b>{title}</b>
        {text && <span>{text}</span>}
        {link && (
          <a className="lv-gate__btn lv-gate__btn--link" href={link.href}>
            {link.label}
          </a>
        )}
        {action && (
          <button type="button" className={link ? 'lv-gate__btn lv-gate__btn--ghost' : 'lv-gate__btn'} onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </main>
  );
}
