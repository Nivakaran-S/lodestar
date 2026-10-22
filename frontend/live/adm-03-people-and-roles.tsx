'use client';
// ADM-03 People and roles, live. Markup and classes from the generated design (frontend/screens/adm-03-people-and-roles.tsx).
// Data: Users (paged, role chips, $search on name, email and staff ID) with their Devices for the status column; the
// scope column names a driver's vehicle and a loader's staff ID under the depot. A row
// opens the person in ADM-04; a person with an open device request (the design's locked row) opens that request
// in ADM-05 instead. "Add person" opens an empty form.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Btn from '@/components/live/Btn';
import { AdminSide, useCount } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { ROLE_INFO, ROLES } from '@/components/live/admin-data';
import { Empty, ErrorBanner, Skeleton, Spinner } from '@/components/live/states';
import { initials } from '@/lib/auth/session';
import { fmtDayTime } from '@/lib/format';
import { useEntitySet } from '@/lib/odata/hooks';
import type { User, UserRole } from '@/lib/odata/types';
import { useFocusId } from '@/lib/workday';
import { useDepots } from '@/components/live/depots';
import { openOverlay } from '@/lib/overlay';

const SIGN_IN: Record<UserRole, string> = {
  DISPATCHER: 'Work email + 2-step', ADMIN: 'Work email + 2-step', LOADER: 'Staff ID on a registered device',
  DRIVER: 'Phone on a registered device', STORE_MANAGER: 'Outlet account',
};
type Chip = 'ALL' | UserRole;

function status(u: User): [string, string] {
  if (!u.isActive) return ['m-tag--bad', 'Disabled'];
  if (u.devices?.some(d => d.status === 'REVOKED')) return ['m-tag--bad', 'Device revoked'];
  if (u.devices?.some(d => d.status === 'PENDING')) return ['m-tag--warn', 'Request open'];
  return ['m-tag--ok', 'Active'];
}

/** Scope column: the outlet, or the depot with a driver's vehicle or a loader's staff ID under it. */
function scope(u: User, depotName: (code: string) => string) {
  if (u.outletId) return u.outletId;
  const depot = u.depot ? depotName(u.depot) : 'All depots';
  const detail = u.role === 'DRIVER' && u.vehicleId ? `Vehicle ${u.vehicleId}` : u.role === 'LOADER' && u.staffId ? `Staff ID ${u.staffId}` : null;
  return detail ? <span className="dx-td2"><b>{depot}</b><span className="dx-mono">{detail}</span></span> : depot;
}

function ChipCount({ role }: { role: UserRole }) {
  const n = useCount('Users', `role eq '${role}'`);
  return <b>{n ?? '…'}</b>;
}

export default function LiveAdm03PeopleAndRoles() {
  const { name: depotName } = useDepots();
  const router = useRouter();
  const [, setFocus] = useFocusId('user');
  const [, setDevice] = useFocusId('device');
  const [chip, setChip] = useState<Chip>('ALL');
  const [search, setSearch] = useState('');
  const total = useCount('Users', undefined);
  const people = useEntitySet<User>('Users', { filter: chip === 'ALL' ? undefined : `role eq '${chip}'`, expand: 'devices($select=id,status)', orderby: 'name', top: 30, count: true, search: search.trim() || undefined });
  const open = (u: User) => {
    const request = u.devices?.find(d => d.status === 'PENDING');
    if (request) {
      setDevice(request.id);
      router.push('/admin/adm-05-access-requests');
      return;
    }
    setFocus(u.id);
    openOverlay('/admin/adm-04-add-or-edit-person');
  };

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="ADM-03 People and roles · desktop">
      <div className="d-app">
        <AdminSide active="N2" />
        <div className="dx-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">{"People and roles "}<span className="m-sep" />{` ${total ?? '…'} people `}<span className="m-sep" />{` ${ROLES.length} faces`}</div>
              <div className="d-h1">{"Who can sign in, where"}</div>
              <div className="d-sub">{"Each person gets one face and one scope. Scope decides what they see: a depot, a vehicle or an outlet."}</div>
            </div>
            <span className="d-btn d-btn--primary" data-lk="L288" onClickCapture={() => setFocus(null)}><Ic n="user-plus" />{"Add person"}</span>
          </div>
          <div className="dx-card" style={{ flex: '1', minHeight: '0' }} data-testid="people">
            <div className="dx-card__head" style={{ minHeight: '62px' }}>
              <div className="d-toolbar">
                {(['ALL', 'DISPATCHER', 'LOADER', 'DRIVER', 'STORE_MANAGER', 'ADMIN'] as Chip[]).map(k => (
                  <span key={k} className={`d-filter lv-click${chip === k ? ' is-on' : ''}`} role="button" tabIndex={0}
                    onClick={e => { e.stopPropagation(); setChip(k); }} onKeyDown={e => { if (e.key === 'Enter') setChip(k); }}>
                    {k === 'ALL' ? 'All' : ROLE_INFO[k].face.replace('Lodestar ', '')} {k === 'ALL' ? <b>{total ?? '…'}</b> : <ChipCount role={k} />}
                  </span>
                ))}
              </div>
              <span className="spacer" />
              <span className="d-search" style={{ width: '220px' }}>
                <Ic n="filter" className="ic ic--sm" />
                <input className="lv-input" aria-label="Search people" placeholder="Name or email" value={search} onChange={e => setSearch(e.target.value)} />
              </span>
            </div>
            <ErrorBanner error={people.error} onRetry={people.refresh} />
            <div className="dx-tr dx-tr--head">
              <span className="dx-td" style={{ width: '250px' }}>{"Name"}</span>
              <span className="dx-td" style={{ width: '190px' }}>{"Role"}</span>
              <span className="dx-td" style={{ width: '190px' }}>{"Scope"}</span>
              <span className="dx-td" style={{ width: '180px' }}>{"Sign-in method"}</span>
              <span className="dx-td" style={{ width: '130px' }}>{"Status"}</span>
              <span className="dx-td" style={{ flex: '1', minWidth: '0' }}>{"Last change"}</span>
            </div>
            {!people.data && !people.error && <Skeleton rows={6} />}
            {people.data?.length === 0 && <Empty title="Nobody here" text="No person matches this filter." icon="people" />}
            {people.data?.map(u => {
              const [cls, label] = status(u);
              const info = ROLE_INFO[u.role];
              return (
                <div key={u.id} className="dx-tr lv-click" style={{ minHeight: '54px' }} data-user={u.id} role="button" tabIndex={0}
                  onClick={e => { e.stopPropagation(); open(u); }} onKeyDown={e => { if (e.key === 'Enter') open(u); }}>
                  <span className="dx-td" style={{ width: '250px' }}>
                    <span className="hstack" style={{ gap: '10px' }}>
                      <span className="d-avatar" style={{ background: 'var(--tint-brand)', color: 'var(--brand-600)', width: '34px', height: '34px' }}>{initials(u.name)}</span>
                      <span className="dx-td2"><b>{u.name}</b><span>{u.email}</span></span>
                    </span>
                  </span>
                  <span className="dx-td" data-label="Role" style={{ width: '190px' }}><span className="hstack" style={{ gap: '8px' }}><Ic n={info?.icon ?? 'user'} className="ic ic--sm" /><span className="dx-td2"><b>{info?.label ?? u.role}</b><span>{info?.face}</span></span></span></span>
                  <span className="dx-td" data-label="Scope" style={{ width: '190px' }}>{scope(u, depotName)}</span>
                  <span className="dx-td" data-label="Sign-in method" style={{ width: '180px' }}><span className="t-2" style={{ color: 'var(--text-2)' }}>{SIGN_IN[u.role]}</span></span>
                  <span className="dx-td" data-label="Status" style={{ width: '130px' }}><span className={`m-tag ${cls}`}><span className="dot" />{label}</span></span>
                  <span className="dx-td" data-label="Last change" style={{ flex: '1', minWidth: '0' }}><span className="dx-mono">{u.updatedAt ? fmtDayTime(u.updatedAt) : '—'}</span></span>
                </div>
              );
            })}
            <div className="spacer" />
            <div className="x-tfoot">
              <span>Showing <b>{people.data?.length ?? 0}</b> of <b>{people.count ?? '…'}</b></span>
              <span className="spacer" />
              <span className="x-link" data-lk="L289">{"Access requests"}<Ic n="chevron-right" /></span>
              {people.hasMore && (people.loadingMore ? <Spinner /> : <Btn className="x-link" onClick={() => void people.loadMore()}>{"Show more"}<Ic n="chevron-down" /></Btn>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
