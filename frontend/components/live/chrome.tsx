'use client';
// The faces' navigation chrome, taken from the design boards (Plan and Admin sidebars, Store desk top bar), with
// live counts and the signed-in user. The sidebar items keep the design's data-lk codes (N0, N1, …), which
// ScreenShell resolves through the screen's own link table, so navigation is exactly the prototype's.
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { initials } from '@/lib/auth/session';
import { BRAND_LETTER, dayFilter, fmtDay, fmtTime } from '@/lib/format';
import { useQuery } from '@/lib/odata/hooks';
import { useEntity } from '@/lib/odata/hooks';
import type { Outlet } from '@/lib/odata/types';
import { depotFilter, useDepot, useRunDate } from '@/lib/workday';
import { Ic, type IconName } from './icons';
import { OfflineSideItem } from './offline';
import { usePlanDrawer } from './plan-nav';
import { useNow } from './store-data';
import { useDepots } from './depots';
import { reportForbidden } from '@/lib/desk-status';

/** `$count` of a set with a filter (null = don't ask). Cached per key by useQuery's identity. */
export function useCount(set: string, filter: string | undefined | null, refreshOn?: string[]) {
  const q = useQuery<number>(filter === null ? null : `count:${set}:${filter ?? ''}`, async c => {
    const page = await c.list(set, { filter: filter ?? undefined, top: 0, count: true });
    return page.count ?? page.value.length;
  }, { refreshOn });
  return q.data;
}

type SideItem = { code: string; icon: IconName; label: string; count?: number; tone?: 'warn' | 'bad'; href?: string } | { sect: string };

// Every item carries its data-lk code, the active one too: ScreenShell only wires codes in the screen's link table
// (some sub-screens link their active item back to the section's main screen).
// An item with its own `href` (a screen added after the generated link tables, e.g. ADM-21 Depots) navigates itself.
function SideItems({ items, active }: { items: SideItem[]; active: string }) {
  const router = useRouter();
  return (
    <>
      {items.map((it, i) =>
        'sect' in it ? (
          <div key={`s${i}`} className="d-side__sect">{it.sect}</div>
        ) : (
          <div
            key={it.code}
            className={`d-side__item${it.code === active ? ' is-on' : ''}${it.href ? ' lv-click' : ''}`}
            data-lk={it.href ? undefined : it.code}
            title={it.label}
            {...(it.href ? {
              role: 'link',
              tabIndex: 0,
              onClick: (e: React.MouseEvent) => { e.stopPropagation(); router.push(it.href!); },
              onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') router.push(it.href!); },
            } : {})}
          >
            <Ic n={it.icon} />
            {it.label}
            {it.count !== undefined && it.count > 0 && (
              <span className={`d-side__count${it.tone === 'warn' ? ' d-side__count--warn' : it.tone === 'bad' ? ' dx-count--bad' : ''}`}>{it.count}</span>
            )}
          </div>
        ),
      )}
    </>
  );
}

function SideFoot({ role, avatarStyle }: { role: string; avatarStyle?: React.CSSProperties }) {
  const { session, logout } = useAuth();
  const name = session?.name ?? '';
  return (
    <div className="d-side__foot">
      <span className="d-avatar" style={avatarStyle}>{initials(name)}</span>
      <div className="vstack" style={{ gap: '0', minWidth: '0' }}>
        <b style={{ whiteSpace: 'nowrap' }}>{name}</b>
        <span className="t-3" style={{ whiteSpace: 'nowrap' }}>{role}</span>
        <span
          className="t-3 lv-click"
          role="button"
          tabIndex={0}
          style={{ textDecoration: 'underline' }}
          onClick={e => { e.stopPropagation(); void logout(); }}
          onKeyDown={e => { if (e.key === 'Enter') void logout(); }}
        >
          Sign out
        </span>
      </div>
    </div>
  );
}

/**
 * Lodestar Plan sidebar (DSP boards). `active` is the item's code: N0 Today … N7 Fleet & outlets. `bellLk` and
 * `brandLk` keep a screen's design links on the bell and the logo. While the desk is offline the sidebar shows the
 * DSP-24 offline marker.
 */
export function PlanSide({ active, bellLk, brandLk }: { active: string; bellLk?: string; brandLk?: string }) {
  const { name: depotName, active: registered } = useDepots();
  const { depot, depots, setDepot, active: inView } = useDepot();
  // Every depot in service, from the registry (ADM-21); the account's own depots first, then the rest (locked).
  const sideDepots = [...depots, ...registered.map(r => r.code).filter(c => !depots.includes(c))];
  const { runDate } = useRunDate('Plans');
  const scope = depotFilter('outlet/depot', inView);
  const cutoff = useCount('Orders', runDate ? [dayFilter('runDate', runDate), "status eq 'RECEIVED'", scope].filter(Boolean).join(' and ') : null, ['notification']);
  const deferrals = useCount('Deferrals', "status eq 'SUGGESTED'", ['notification']);
  const items: SideItem[] = [
    { code: 'N0', icon: 'home', label: 'Today' },
    { code: 'N1', icon: 'list', label: 'Cutoff queue', count: cutoff },
    { code: 'N2', icon: 'grid', label: 'Plan board' },
    { code: 'N3', icon: 'history', label: 'Deferrals', count: deferrals, tone: 'warn' },
    { code: 'N4', icon: 'navigate', label: 'Live operations' },
    { code: 'N5', icon: 'alert', label: 'Exceptions' },
    { code: 'N6', icon: 'chart', label: 'Capacity outlook' },
    { sect: 'Records' },
    { code: 'N7', icon: 'truck', label: 'Fleet & outlets' },
    { code: 'N8', icon: 'sparkle-plus', label: 'Intelligence' },
    { code: 'N9', icon: 'cog', label: 'Settings' },
  ];
  const drawer = usePlanDrawer();
  return (
    <>
    {drawer.bar}
    <aside id="plan-nav" className={`d-side${drawer.open ? ' is-open' : ''}`} aria-label="Lodestar Plan navigation">
      <div className="d-side__brand" style={{ whiteSpace: 'nowrap', paddingRight: '0' }}>
        <svg viewBox="0 0 32 32" {...(brandLk ? { 'data-lk': brandLk } : {})}><rect width="32" height="32" rx="8" fill="#3B4CCA" /><g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></g></svg>
        Lodestar Plan
        <span className="dx-bell" {...(bellLk ? { 'data-lk': bellLk } : {})}><Ic n="bell" /></span>
      </div>
      <SideItems items={items} active={active} />
      <OfflineSideItem />
      <div className="d-side__sect">Depots</div>
      {sideDepots.map(d => {
        const mine = depots.includes(d);
        const go = () => {
          if (mine) setDepot(depot === d ? null : d);
          // A registered depot outside the account: the DSP-36 "no access" screen says so and offers a request.
          else reportForbidden({ status: 403, target: 'depot', message: `You do not plan for depot ${d}` });
        };
        return (
          <div
            key={d}
            className={`d-side__item lv-click${depot === d ? ' is-on' : ''}`}
            style={depot === d ? undefined : { color: mine ? 'var(--text)' : 'var(--text-3)' }}
            role="button"
            tabIndex={0}
            aria-pressed={depot === d}
            data-depot={d}
            title={!mine ? `${depotName(d)} is not one of your depots` : depot === d ? 'Show all your depots' : `Show ${depotName(d)} only`}
            onClick={e => { e.stopPropagation(); go(); }}
            onKeyDown={e => { if (e.key === 'Enter') go(); }}
          >
            <Ic n={mine ? 'depot' : 'lock'} />
            {depotName(d)}
          </div>
        );
      })}
      <SideFoot role={`Dispatcher · ${depots.length} depot${depots.length === 1 ? '' : 's'}`} />
    </aside>
    </>
  );
}

// Admin writes (approve or decline a device, revoke a phone, save a person, an outlet, a vehicle, an import) call
// adminChanged() so the sidebar's counts are read again on the same page, not only on the next navigation.
let adminVersion = 0;
const adminListeners = new Set<() => void>();
export function adminChanged() {
  adminVersion += 1;
  adminListeners.forEach(l => l());
}
const subscribeAdmin = (l: () => void) => {
  adminListeners.add(l);
  return () => { adminListeners.delete(l); };
};

/** A sidebar count read again after every admin write and on every realtime notification (a new device request). */
function useAdminCount(set: string, filter: string | undefined) {
  const v = useSyncExternalStore(subscribeAdmin, () => adminVersion, () => 0);
  const q = useQuery<number>(`count:${set}:${filter ?? ''}`, async c => {
    const page = await c.list(set, { filter, top: 0, count: true });
    return page.count ?? page.value.length;
  }, { refreshOn: ['notification'] });
  const { refresh } = q;
  const seen = useRef(v);
  useEffect(() => {
    if (seen.current === v) return;
    seen.current = v;
    void refresh();
  }, [v, refresh]);
  return q.data;
}

/** ADM-21 Depots: the depot registry (not in the generated link tables, so its sidebar item carries the href). */
export const ADMIN_DEPOTS = '/admin/adm-21-depots';

const ADMIN_LOGO = <svg aria-hidden width="28" height="28" viewBox="0 0 32 32" style={{ flexShrink: '0' }}><rect width="32" height="32" rx="8" fill="#334155" /><g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></g></svg>;

/** Lodestar Admin sidebar (ADM boards). `active`: N0 Overview … N11 Notifications, D1 Depots. */
export function AdminSide({ active }: { active: string }) {
  const requests = useAdminCount('Devices', "status eq 'PENDING'");
  const people = useAdminCount('Users', undefined);
  const revoked = useAdminCount('Devices', "status eq 'REVOKED'");
  const outlets = useAdminCount('Outlets', undefined);
  const depotCount = useDepots().active.length || undefined;
  const vehicles = useAdminCount('Vehicles', undefined);
  const items: SideItem[] = [
    { code: 'N0', icon: 'home', label: 'Overview' },
    { code: 'N1', icon: 'key', label: 'Access requests', count: requests, tone: 'warn' },
    { code: 'N2', icon: 'people', label: 'People and roles', count: people },
    { code: 'N3', icon: 'phone', label: 'Devices', count: revoked, tone: 'bad' },
    { sect: 'Master data' },
    { code: 'D1', icon: 'depot', label: 'Depots', count: depotCount, href: ADMIN_DEPOTS },
    { code: 'N4', icon: 'store', label: 'Outlets', count: outlets },
    { code: 'N5', icon: 'truck', label: 'Vehicles', count: vehicles },
    { code: 'N6', icon: 'sliders', label: 'Operating rules' },
    { code: 'N7', icon: 'calendar', label: 'Calendar' },
    { sect: 'Data and trust' },
    { code: 'N8', icon: 'upload', label: 'Data imports' },
    { code: 'N9', icon: 'history', label: 'Audit log' },
    { code: 'N10', icon: 'sparkle-plus', label: 'Planning agent' },
    { code: 'N11', icon: 'message', label: 'Notifications' },
  ];
  const drawer = usePlanDrawer({ navId: 'admin-nav', brand: <>{ADMIN_LOGO}Lodestar Admin</> });
  return (
    <>
    {drawer.bar}
    <aside id="admin-nav" className={`d-side${drawer.open ? ' is-open' : ''}`} aria-label="Lodestar Admin navigation">
      <div className="d-side__brand" style={{ whiteSpace: 'nowrap' }}>
        {ADMIN_LOGO}
        Lodestar Admin
      </div>
      <SideItems items={items} active={active} />
      <SideFoot role="Systems admin" avatarStyle={{ background: '#334155', color: '#FFFFFF' }} />
    </aside>
    </>
  );
}

const STORE_LOGO = (
  <svg viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="8" fill="#047857" /><g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M5 13v8h14v-8M10 21v-5h4v5" /></g></svg>
);

const STORE_NAV: Array<{ key: string; icon: IconName; label: string; href: string }> = [
  // the design's "Order" tab opens Orders & history (SM-27), where "New order" starts SM-01
  { key: 'order', icon: 'plus', label: 'Order', href: '/store/sm-27-orders-and-history' },
  { key: 'deliveries', icon: 'van-2', label: 'Deliveries', href: '/store/sm-02-deliveries' },
  { key: 'receipts', icon: 'check', label: 'Receipts', href: '/store/sm-28-receipts-and-credit-notes' },
  { key: 'messages', icon: 'message', label: 'Messages', href: '/store/sm-29-messages' },
];

/** The store manager's outlet (from the token's outlet_id claim). */
export function useMyOutlet() {
  const { session } = useAuth();
  return useEntity<Outlet>('Outlets', session?.outletId ?? null);
}

/** Lodestar Store top bar (SM boards). `avatarLk` keeps the design's link on the avatar where it has one. */
export function StoreTop({ active, avatarLk, extra }: { active: string; avatarLk?: string; extra?: ReactNode }) {
  const router = useRouter();
  const { session, logout } = useAuth();
  const outlet = useMyOutlet();
  const unread = useCount('Notifications', 'readAt eq null', ['notification', 'credit_note_issued', 'eta_update', 'plan_published', 'trip_released']);
  const now = useNow();
  const o = outlet.data;
  // below 900 px the nav and the outlet move into a side drawer opened from the menu button (app/styles/live.css)
  const [open, setOpen] = useState(false);
  const burger = useRef<HTMLButtonElement | null>(null);
  const drawer = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    drawer.current?.querySelector<HTMLElement>('[tabindex="0"], button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); burger.current?.focus(); } };
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 900px)') : null;
    const onWide = () => { if (mq?.matches) setOpen(false); };
    document.addEventListener('keydown', onKey);
    mq?.addEventListener('change', onWide);
    return () => { document.removeEventListener('keydown', onKey); mq?.removeEventListener('change', onWide); };
  }, [open]);
  const go = (href: string) => { setOpen(false); router.push(href); };
  const outletChip = (
    <div className="s-top__outlet">
      <span className={`bb bb--${(o?.brand ?? 'FRESH').toLowerCase()}`}>{BRAND_LETTER[o?.brand ?? 'FRESH']}</span>
      {o?.name ?? (outlet.loading ? 'Loading outlet…' : 'Your outlet')}
      <span className="id">{session?.outletId}</span>
    </div>
  );
  const items = STORE_NAV.map(n => (
    <span
      key={n.key}
      className={`s-top__i${n.key === active ? ' is-on' : ' lv-click'}`}
      role={n.key === active ? undefined : 'link'}
      tabIndex={n.key === active ? undefined : 0}
      aria-current={n.key === active ? 'page' : undefined}
      onClick={n.key === active ? () => setOpen(false) : e => { e.stopPropagation(); go(n.href); }}
      onKeyDown={n.key === active ? undefined : e => { if (e.key === 'Enter') go(n.href); }}
    >
      <Ic n={n.icon} />
      {n.label}
      {n.key === 'messages' && unread ? <span className="s-top__count">{unread}</span> : null}
    </span>
  ));
  return (
    <div className="s-top">
      <button
        ref={burger}
        type="button"
        className="s-burger"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        aria-controls="store-nav"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <div className="s-top__brand">
        {STORE_LOGO}
        Lodestar Store
      </div>
      {outletChip}
      <div className="s-top__nav">{items}</div>
      <div className="spacer" />
      {extra}
      <span className="s-top__clock">{fmtDay(new Date(now))} · {fmtTime(new Date(now))}</span>
      <div className="m-iconbtn lv-click" title="Sign out" role="button" tabIndex={0} onClick={e => { e.stopPropagation(); void logout(); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); void logout(); } }}>
        <Ic n="log-in" />
      </div>
      <span className="d-avatar" {...(avatarLk ? { 'data-lk': avatarLk } : {})} title={session?.name}>{initials(session?.name ?? '')}</span>
      {open && <div className="s-backdrop" aria-hidden onClick={e => { e.stopPropagation(); setOpen(false); }} />}
      <aside id="store-nav" ref={drawer} className={`s-drawer${open ? ' is-open' : ''}`} aria-label="Lodestar Store navigation">
        <div className="s-top__brand">{STORE_LOGO}Lodestar Store</div>
        {outletChip}
        <nav className="s-drawer__nav">{items}</nav>
        <div className="spacer" />
        <div className="s-drawer__foot">
          <span className="d-avatar">{initials(session?.name ?? '')}</span>
          <div className="vstack" style={{ gap: '2px', minWidth: 0 }}>
            <b>{session?.name}</b>
            <span className="lv-link" role="button" tabIndex={0} onClick={e => { e.stopPropagation(); void logout(); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void logout(); } }}>{"Sign out"}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
