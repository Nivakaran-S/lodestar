// Display formats used by the designs ("Tue 7 Apr", "6:35", "3:30 AM", "1,390"). Times are shown in the depots'
// time zone, whatever the viewer's machine is set to.

export const TIME_ZONE = 'Asia/Colombo';
const LOCALE = 'en-GB';

const parts = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...opts }).formatToParts(d).map(p => [p.type, p.value]));

const toDate = (v: string | number | Date | null | undefined): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "Tue 7 Apr" */
export function fmtDay(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  const p = parts(d, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** A run date (stored as UTC midnight) as "Tue 7 Apr", without a time-zone shift. */
export function fmtRunDate(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(d).map(x => [x.type, x.value]),
  );
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "6:35" (24-hour clock without a leading zero, as the boards write ETAs) */
export function fmtClock(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  const p = parts(d, { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });
  return `${Number(p.hour)}:${p.minute}`;
}

/** "3:30 AM" */
export function fmtTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  const p = parts(d, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${Number(p.hour)}:${p.minute} ${String(p.dayPeriod ?? '').toUpperCase()}`.trim();
}

/** "Tue 7 Apr · 3:30 AM" */
export function fmtDayTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? `${fmtDay(d)} · ${fmtTime(d)}` : '—';
}

/** "2026-04-07 06:58:12" for audit trails */
export function fmtStamp(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  const p = parts(d, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** "1,390" ; "6.2" with `digits` */
export function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "5 min ago", "2 h ago", or the day for older times. */
export function fmtAgo(v: string | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(v);
  if (!d) return '—';
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 0) return fmtDayTime(d);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDay(d);
}

/** Percentage of `part` in `whole`, clamped to 0..100 (bar widths). */
export function pct(part: number | null | undefined, whole: number | null | undefined): number {
  if (!part || !whole) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** ISO date (YYYY-MM-DD) of a run date. */
export function isoDay(v: string | Date): string {
  const d = toDate(v);
  return d ? d.toISOString().slice(0, 10) : '';
}

/** OData filter for a whole run date (run dates are stored as UTC midnight). */
export function dayFilter(field: string, day: string): string {
  const start = new Date(`${day}T00:00:00Z`);
  const end = new Date(start.getTime() + 86_400_000);
  return `${field} ge ${start.toISOString()} and ${field} lt ${end.toISOString()}`;
}

export function addDays(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/** "Fresh" from FRESH, "Nuwara Eliya" stays. */
export function title(v: string | null | undefined): string {
  if (!v) return '';
  return v.toLowerCase().replace(/(^|[\s_])([a-z])/g, (_m, sep: string, c: string) => (sep === '_' ? ' ' : sep) + c.toUpperCase());
}

export const BRAND_LETTER: Record<string, string> = { FRESH: 'F', STYLE: 'S', TECH: 'T' };

/** ISO day (YYYY-MM-DD) `n` days before today's business date in Colombo (not the UTC date). */
export function daysAgo(n: number, now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return addDays(today, -n);
}

/**
 * Late risk (TripStop.lateRiskPct) at or above this is "at risk": the live board's tags and "At risk" filter, the
 * exceptions inbox, the store's next-delivery tag and the default alert threshold in Plan settings. The planning
 * backend sets no threshold of its own, so this is the one value the desk uses.
 */
export const LATE_RISK_PCT = 30;
/** Colour banding only: an at-risk stop at or above this reads red (exception) instead of amber. */
export const LATE_RISK_HIGH_PCT = 60;

/**
 * A plan's notes as text. The planning service stores the agent's explanation as JSON ({ text, did, checked });
 * older plans and hand-made ones carry plain text.
 */
export function planNote(v: string | null | undefined): string | null {
  const t = v?.trim();
  if (!t) return null;
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t) as { text?: unknown };
      if (typeof o.text === 'string') return o.text;
    } catch {
      // not JSON after all: show it as written
    }
  }
  return t;
}
