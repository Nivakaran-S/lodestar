'use client';
// ADM-18 Notifications and integrations, live. Markup and classes from the generated design
// (frontend/screens/adm-18-notifications-and-integrations.tsx).
// Lodestar reaches people only through its apps: every Notification is stored and pushed over the realtime hub
// (notifications.service.ts). So the one channel drawn is "App push": today's Notifications count and whether
// the hub is connected (this page's own socket goes through the same gateway).
// "Send a test" sends a real notification to the signed-in admin only (Notifications/Lodestar.Send to their own
// user id, type ADMIN_TEST): it is stored, pushed to their open apps and shows in the channel's count.
// "Who gets what" is read from what Lodestar sent today: each notification type with its count and the roles of
// the people who received it.
// Not drawn: SMS gateway, email relay and voice-call codes (no such integrations), "Delayed today" (no delivery
// receipts) and the voice-call fallback rule: the backend has none of them.
import { useState } from 'react';
import Btn from '@/components/live/Btn';
import { AdminSide } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { ROLE_INFO } from '@/components/live/admin-data';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { useAuth } from '@/lib/auth/AuthProvider';
import { daysAgo, fmtDay, fmtNum, fmtTime, title } from '@/lib/format';
import { useAction, useQuery, useRealtimeStatus } from '@/lib/odata/hooks';
import type { Notification, User, UserRole } from '@/lib/odata/types';

interface Today {
  total: number;
  types: Array<{ type: string; count: number; roles: UserRole[] }>;
}

export default function LiveAdm18NotificationsAndIntegrations() {
  const { session } = useAuth();
  const since = `${daysAgo(0)}T00:00:00Z`;
  const today = useQuery<Today>('adm18-today', async c => {
    // the server pages at 500 rows ($top above it is refused): take today's in pages, with the total from $count
    const first = await c.list<Notification>('Notifications', { filter: `sentAt ge ${since}`, select: 'id,type,recipientId', orderby: 'sentAt desc', top: 500, count: true });
    const rows = [...first.value];
    for (let p = first, i = 1; p.nextLink && i < 20; i++) { p = await c.next<Notification>(p.nextLink); rows.push(...p.value); }
    const page = { value: rows, count: first.count };
    const ids = [...new Set(page.value.map(n => n.recipientId))];
    const users = ids.length ? await c.all<User>('Users', { filter: `id in (${ids.map(i => `'${i}'`).join(',')})`, select: 'id,role' }) : [];
    const role = new Map(users.map(u => [u.id, u.role]));
    const byType = new Map<string, { count: number; roles: Set<UserRole> }>();
    for (const n of page.value) {
      const t = byType.get(n.type) ?? { count: 0, roles: new Set<UserRole>() };
      t.count += 1;
      const r = role.get(n.recipientId);
      if (r) t.roles.add(r);
      byType.set(n.type, t);
    }
    return {
      total: page.count ?? page.value.length,
      types: [...byType.entries()].map(([type, t]) => ({ type, count: t.count, roles: [...t.roles].sort((a, b) => String(a).localeCompare(String(b))) })).sort((a, b) => b.count - a.count),
    };
  }, { refreshOn: ['notification'] });
  const hub = useRealtimeStatus();
  const up = hub === 'connected';
  const state = up ? 'Up' : hub === 'offline' ? 'Down' : 'Connecting';
  const [message, setMessage] = useState(() => `Lodestar test from Admin, ${fmtDay(new Date())} ${fmtTime(new Date())}. No reply needed.`);
  const test = useAction<void, Notification>(c => c.action<Notification>('Notifications', null, 'Send', {
    recipientId: session!.sub, type: 'ADMIN_TEST', payload: { message: message.trim(), from: session!.name },
  }), { onSuccess: () => void today.refresh() });

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="ADM-18 Notifications and integrations · desktop">
      <div className="d-app">
        <AdminSide active="N11" />
        <div className="dx-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">{"Trust "}<span className="m-sep" />{" outbound messages"}</div>
              <div className="d-h1">{"Notifications and integrations"}</div>
              <div className="d-sub">{"How Lodestar reaches people: every alert is stored and pushed to the person's Plan, Dock, Run or Store app."}</div>
            </div>
          </div>
          <ErrorBanner error={today.error} onRetry={today.refresh} />
          <div className="dx-hrow" style={{ flex: '1', minHeight: '0' }}>
            <div className="dx-card" style={{ flex: '1.15' }} data-testid="channels">
              <div className="dx-card__head">
                <span className="dx-card__title">{"Channels"}</span>
                <span className="spacer" />
                <span className={`m-tag ${up ? 'm-tag--ok' : 'm-tag--warn'}`}><span className="dot" />{up ? 'All up' : state}</span>
              </div>
              <div className="dx-lrow" style={{ minHeight: '86px' }} data-channel="push">
                <span className="dx-lead" style={{ width: '44px', height: '44px' }}><Ic n="bell" /></span>
                <div className="dx-lrow__main">
                  <span className="dx-lrow__t">{"App push"}</span>
                  <span className="dx-lrow__m">{"Plan, Dock, Run and Store alerts"}</span>
                </div>
                <div className="dx-lrow__tr">
                  <span className={`m-tag ${up ? 'm-tag--ok' : 'm-tag--warn'}`}><span className="dot" />{state}</span>
                  <span>{today.data ? `${fmtNum(today.data.total)} today` : '…'}</span>
                </div>
              </div>
              {test.data && (
                <div className="dx-inset dx-inset--info" style={{ flexDirection: 'row', gap: '10px', padding: '12px 14px', margin: '12px 16px' }} data-testid="test-result">
                  <Ic n="check" className="ic ic--sm" />
                  <span className="dx-t13" style={{ color: 'var(--text-2)' }}>
                    <b>{`Test sent ${fmtTime(test.data.sentAt)}.`}</b>{` Stored as ${test.data.id} and pushed to your open Lodestar apps.`}
                  </span>
                </div>
              )}
            </div>
            <div className="dx-col" style={{ flex: '1' }}>
              <div className="dx-card">
                <div className="dx-card__head"><span className="dx-card__title">{"Send a test"}</span></div>
                <div className="dx-card__body" style={{ gap: '14px' }}>
                  <div className="dx-field">
                    <span className="dx-label">{"Channel"}</span>
                    <div className="dx-tabs"><span className="dx-tab is-on" role="tab" aria-selected>{"App push"}</span></div>
                  </div>
                  <div className="dx-field">
                    <span className="dx-label">{"To"}</span>
                    <div className="dx-input dx-input--sm"><Ic n="user" />{`${session?.name ?? '…'} · your own account`}</div>
                  </div>
                  <div className="dx-field">
                    <span className="dx-label">{"Message"}</span>
                    <div className="x-textarea" style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--line-strong)' }}>
                      <textarea className="lv-input" aria-label="Test message" value={message} onChange={e => setMessage(e.target.value)} />
                    </div>
                  </div>
                  <ErrorBanner error={test.error} />
                  <div className="hstack">
                    <span className="dx-t13" style={{ flex: '1' }}>{"Tests go only to you"}</span>
                    <Btn className="d-btn d-btn--primary" testId="send-test" busy={test.pending} disabled={!session || !message.trim()} onClick={() => void test.run()}>
                      <Ic n="send" />{"Send test push"}
                    </Btn>
                  </div>
                </div>
              </div>
              <div className="dx-card" style={{ flex: '1' }} data-testid="who-gets-what">
                <div className="dx-card__head"><span className="dx-card__title">{"Who gets what"}</span><span className="spacer" /><span className="dx-t13">{"sent today"}</span></div>
                <div className="dx-card__body" style={{ gap: '0' }}>
                  {!today.data && !today.error && <Skeleton rows={3} />}
                  {today.data?.types.length === 0 && <Empty title="Nothing sent today" text="Alerts appear here as Lodestar sends them." icon="bell" />}
                  {today.data?.types.map(t => (
                    <div key={t.type} className="dx-kv" data-type={t.type}>
                      <span>{`${t.roles.length ? t.roles.map(r => ROLE_INFO[r]?.label ?? r).join(', ') : 'Service'}: ${title(t.type).toLowerCase()}`}</span>
                      <b>{`${fmtNum(t.count)} · app`}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
