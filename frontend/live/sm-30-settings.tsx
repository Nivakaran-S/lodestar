'use client';
// SM-30 Settings, live. Markup and classes from the generated design (frontend/screens/sm-30-settings.tsx).
// Data: the store's outlet (Outlets: dock type, parking, window, access note "as drivers see it") and the store
// manager's own preferences (Users/Lodestar.MyPreferences / SaveMyPreferences): receiving staff and the time they
// are at the door, notification channels per topic (app / SMS) and the language of this desk. "Short or moved
// orders" is always on (locked), as designed. "Save changes" saves and goes to Deliveries (the design's L139).
// "Users & access" shows the signed-in manager and this browser's session (sign out ends it). Store accounts and
// the outlet's dock details are kept by the Lodestar admin (ADM-04, ADM-09), so "Invite" and "Request a change"
// write to the admin (NEXT_PUBLIC_SUPPORT_EMAIL, else a call to NEXT_PUBLIC_SUPPORT_PHONE); with neither set they
// say who to ask. "Discard" drops the edits and, as designed (L139), goes back to Deliveries. The sub-navigation
// is a set of tabs: each shows its own section (Store details, Receiving, Notifications, Users & access, Language);
// edits made in one tab are kept while another is open, and "Save changes" saves them all.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Btn from '@/components/live/Btn';
import { StoreTop, useMyOutlet } from '@/components/live/chrome';
import { Ic, type IconName } from '@/components/live/icons';
import { type Channels, type Preferences, type ReceivingStaff, SMS_UNAVAILABLE, type StoreTopic, useDeliveryChannels, useOutletUsers, usePreferences } from '@/components/live/settings-data';
import { ErrorBanner, Skeleton } from '@/components/live/states';
import { useAuth } from '@/lib/auth/AuthProvider';
import { resetOptions, telHref } from '@/lib/auth/reset';
import { fmtDayTime, title } from '@/lib/format';
import { useDepots } from '@/components/live/depots';

const TOPICS: Array<{ k: StoreTopic; label: string; sub: string; def: Channels }> = [
  { k: 'arrivalWindow', label: 'Arrival window', sub: 'by 7 PM the evening before', def: { app: true, sms: true } },
  { k: 'vanOnTheWay', label: 'Van on the way', sub: 'live from departure', def: { app: true, sms: false } },
  { k: 'cutoffReminder', label: 'Cutoff reminder', sub: '3:00 PM if not ordered', def: { app: true, sms: false } },
  { k: 'creditNotes', label: 'Credit notes', sub: 'when raised and matched', def: { app: true, sms: false } },
];
const LANGS: Array<[NonNullable<Preferences['language']>, string, string]> = [['en', 'English', ''], ['si', 'සිංහල', ' vo-si'], ['ta', 'தமிழ்', ' vo-ta']];
const DOCK: Record<string, string> = { REAR_DOCK: 'Rear dock', STREET: 'Street', MALL_BAY: 'Mall bay' };
const PARKING: Record<string, string> = { NORMAL: 'normal access', VAN_ONLY: 'vans only', MALL_DOCK: 'mall dock' };
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
const clock = (v: string) => { const [h, m] = v.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
/** What each directory role may do at a store, and its pill (SM-30 "Users & access"). */
const ROLE: Record<string, [string, string, string]> = { STORE_MANAGER: ['Store manager · orders, receipts, settings', 'Owner', 'm-pill--brand'] };
const roleOf = (role: string): [string, string, string] => ROLE[role] ?? [title(role), title(role), ''];
const SECTIONS: Array<[string, IconName, string]> = [
  ['store', 'store', 'Store details'], ['receiving', 'people', 'Receiving'], ['notifications', 'bell', 'Notifications'], ['access', 'key', 'Users & access'], ['language', 'globe', 'Language'],
];

/** A request to the Lodestar admin: a mail when a support address is set, else a call to the support phone. */
function adminLink(subject: string, body: string): string | null {
  const { supportEmail, supportPhone } = resetOptions();
  if (supportEmail) return `mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return supportPhone ? telHref(supportPhone) : null;
}

function Tg({ on, locked, label, onChange, unavailable }: { on: boolean; locked?: boolean; label: string; onChange?: (v: boolean) => void; unavailable?: string }) {
  // a channel this deployment does not offer (SMS without SMS_ENABLED): shown off and disabled, with the reason
  if (unavailable) return <div className="sx-tg" role="switch" aria-checked={false} aria-disabled="true" aria-label={label} title={unavailable} style={{ opacity: 0.45 }}><div /></div>;
  const cls = `sx-tg${on ? ' is-on' : ''}${locked ? ' is-lock' : ''}`;
  if (locked || !onChange) return <div className={cls} role="switch" aria-checked={on} aria-label={label}><div /></div>;
  return (
    <div className={`${cls} lv-click`} role="switch" aria-checked={on} aria-label={label} tabIndex={0}
      onClick={e => { e.stopPropagation(); onChange(!on); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!on); } }}>
      <div />
    </div>
  );
}

export default function LiveSm30Settings() {
  const { name: depotName } = useDepots();
  const router = useRouter();
  const { session, logout } = useAuth();
  const outlet = useMyOutlet();
  const prefs = usePreferences();
  // SMS only when the deployment sends it (Notifications/Lodestar.Channels)
  const smsOff = useDeliveryChannels().data?.sms === true ? undefined : SMS_UNAVAILABLE;
  // the active sign-ins of this outlet, from the directory (Users/Lodestar.MyOutletUsers)
  const users = useOutletUsers(Boolean(session?.outletId));
  // no directory row yet (or no outlet on the token): the signed-in user, as the token names them
  const me = { id: session?.sub ?? 'me', name: session?.name ?? '', role: session?.roles.includes('store_manager') ? 'STORE_MANAGER' : '', self: true };
  const loadingUsers = Boolean(session?.outletId) && !users.data && !users.error;
  const people = loadingUsers ? null : users.data?.length ? users.data : [me];
  // Local edits on top of the saved preferences; null = nothing edited.
  const [edit, setEdit] = useState<Preferences | null>(null);
  const draft: Preferences | null = edit ?? prefs.data ?? null;
  const setDraft = (next: Preferences | ((d: Preferences | null) => Preferences)) =>
    setEdit(e => (typeof next === 'function' ? next(e ?? prefs.data ?? null) : next));
  const [adding, setAdding] = useState<ReceivingStaff | null>(null);
  const o = outlet.data;
  const staff = draft?.receiving?.staff ?? [];
  const staffFrom = draft?.receiving?.staffFrom ?? '';
  const lang = draft?.language ?? 'en';
  const channels = (t: (typeof TOPICS)[number]) => ({ ...t.def, ...(draft?.notifications?.[t.k] ?? {}) });
  const setChannel = (t: (typeof TOPICS)[number], ch: keyof Channels, v: boolean) =>
    setDraft(d => ({ ...(d ?? {}), notifications: { ...(d?.notifications ?? {}), [t.k]: { ...channels(t), [ch]: v } } }));
  const setReceiving = (r: NonNullable<Preferences['receiving']>) => setDraft(d => ({ ...(d ?? {}), receiving: { ...(d?.receiving ?? {}), ...r } }));
  const [section, setSection] = useState('store');
  const goTo = (k: string) => setSection(k);
  const outletRef = `${o?.name ?? 'our outlet'} (${session?.outletId ?? ''})`;
  const changeLink = adminLink(`Lodestar Store: dock details for ${outletRef}`,
    `Hello,\n\nPlease update the dock details drivers see for ${outletRef}.\nNow: ${o ? (o.accessNote || `${DOCK[o.dockType] ?? o.dockType}, ${PARKING[o.parking] ?? o.parking}, window ${o.windowOpen}-${o.windowClose}`) : ''}\nChange to: \n\nThank you,\n${session?.name ?? ''}`);
  const inviteLink = adminLink(`Lodestar Store: new user for ${outletRef}`,
    `Hello,\n\nPlease add a Lodestar Store sign-in for ${outletRef}.\nName: \nEmail: \nRole: \n\nThank you,\n${session?.name ?? ''}`);
  const save = () => void prefs.save.run({
    receiving: draft?.receiving ?? {},
    notifications: Object.fromEntries(TOPICS.map(t => [t.k, channels(t)])),
    language: lang,
  })
    .then(r => { if (r) { setEdit(null); router.push('/store/sm-02-deliveries'); } });

  return (
    <div className="frame frame--desktop mode-store" data-name="SM-30 Settings · desktop">
      <div className="s-shell">
        <StoreTop active="settings" />
        <div className="d-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {o?.name ?? 'Your outlet'}{" "}<span className="m-sep" />{` ${session?.outletId ?? ''} `}
                {o && <><span className="m-sep" />{` ${depotName(o.depot)}`}</>}
              </div>
              <div className="d-h1">{"Settings"}</div>
            </div>
            <Btn className="d-btn d-btn--ghost" lk="L139" testId="discard" onClick={() => { setEdit(null); setAdding(null); }}>{"Discard"}</Btn>
            <Btn className="d-btn d-btn--primary" lk="L139" busy={prefs.save.pending} disabled={!draft} onClick={save}>{"Save changes"}</Btn>
          </div>
          <ErrorBanner error={prefs.error ?? prefs.save.error ?? outlet.error ?? users.error} onRetry={() => { void prefs.refresh(); void outlet.refresh(); void users.refresh(); }} />
          <div className="d-split">
            <div className="sx-subnav" role="tablist" aria-label="Settings" aria-orientation="vertical">
              {SECTIONS.map(([k, icon, label]) => (
                <span key={k} className={`d-side__item lv-click${section === k ? ' is-on' : ''}`} role="tab" aria-selected={section === k} tabIndex={0}
                  onClick={e => { e.stopPropagation(); goTo(k); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(k); } }}>
                  <Ic n={icon} />{label}
                </span>
              ))}
            </div>
            <div className="vstack" style={{ gap: '18px', flex: '1', minWidth: '0' }} role="tabpanel">
              {section === 'store' && (
              <div className="d-card" data-testid="dock-note" data-section="store">
                <div className="d-card__head">
                  <span className="d-card__title">{"Store details"}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{"kept by your Lodestar admin"}</span>
                  <div className="spacer" />
                  {changeLink
                    ? <a className="d-btn" style={{ height: '34px' }} href={changeLink} data-testid="request-change">{"Request a change"}</a>
                    : <span style={{ fontSize: '13px', color: 'var(--text-3)' }} data-testid="request-change">{"Your Lodestar admin changes these details."}</span>}
                </div>
                {!o ? <Skeleton rows={4} /> : (
                  <>
                    <div className="sx-set-row"><div className="sx-set-row__main"><b>{o.name}</b><span>{`${session?.outletId ?? o.id} · supplied from ${depotName(o.depot)}`}</span></div></div>
                    <div className="sx-set-row"><div className="sx-set-row__main"><b>{"Dock"}</b><span>{`${DOCK[o.dockType] ?? o.dockType} · ${PARKING[o.parking] ?? o.parking}`}</span></div></div>
                    <div className="sx-set-row"><div className="sx-set-row__main"><b>{"Delivery window"}</b><span>{`${o.windowOpen}–${o.windowClose}`}</span></div></div>
                    <div className="sx-set-row"><div className="sx-set-row__main"><b>{"Your dock, as drivers see it"}</b><span>{o.accessNote || `${DOCK[o.dockType] ?? o.dockType} · ${PARKING[o.parking] ?? o.parking} · window ${o.windowOpen}–${o.windowClose}`}</span></div></div>
                  </>
                )}
              </div>
              )}
              {section === 'receiving' && (
              <div className="d-card" data-testid="receiving-staff" data-section="receiving">
                <div className="d-card__head">
                  <span className="d-card__title">{"Receiving staff"}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{`shown to the driver and ${o ? depotName(o.depot) : 'the depot'}`}</span>
                  <div className="spacer" />
                  <Btn className="d-btn" style={{ height: '34px' }} disabled={!draft || staff.length >= 20} onClick={() => setAdding({ name: '', phone: '', note: '' })}><Ic n="user-plus" />{"Add staff"}</Btn>
                </div>
                {!draft ? <Skeleton rows={3} /> : (
                  <>
                    <div className="sx-set-row">
                      <div className="m-row__lead"><Ic n="clock" /></div>
                      <div className="sx-set-row__main">
                        <b>{"Staff at the door from"}</b>
                        <span>{o ? `window ${o.windowOpen}–${o.windowClose}` : ''}</span>
                      </div>
                      <input className="lv-input sx-chip" type="time" aria-label="Staff at the door from" style={{ width: '120px' }} value={staffFrom}
                        onChange={e => setReceiving({ staffFrom: e.target.value })} />
                    </div>
                    {staff.map((s, i) => (
                      <div key={`${s.name}-${i}`} className="sx-set-row">
                        <span className="sx-set-av">{initials(s.name)}</span>
                        <div className="sx-set-row__main">
                          <b>{s.name}</b>
                          <span>{['Receiver', s.phone, s.note].filter(Boolean).join(' · ')}</span>
                        </div>
                        <Btn className="sx-link" title={`Remove ${s.name}`} onClick={() => setReceiving({ staff: staff.filter((_, j) => j !== i) })}>{"Remove"}</Btn>
                      </div>
                    ))}
                    {staff.length === 0 && !adding && <div className="sx-set-row"><div className="sx-set-row__main"><span>{"No receiving staff yet. Drivers see the names you add here."}</span></div></div>}
                    {adding && (
                      <div className="sx-set-row" data-testid="add-staff">
                        <input className="lv-input" aria-label="Name" placeholder="Name" value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} />
                        <input className="lv-input" aria-label="Phone" placeholder="Phone" value={adding.phone} onChange={e => setAdding({ ...adding, phone: e.target.value })} />
                        <input className="lv-input" aria-label="Note" placeholder="Note (signs for deliveries…)" value={adding.note} onChange={e => setAdding({ ...adding, note: e.target.value })} />
                        <Btn className="d-btn d-btn--primary" disabled={!adding.name.trim()} onClick={() => {
                          setReceiving({ staff: [...staff, { name: adding.name.trim(), ...(adding.phone?.trim() ? { phone: adding.phone.trim() } : {}), ...(adding.note?.trim() ? { note: adding.note.trim() } : {}) }] });
                          setAdding(null);
                        }}>{"Add"}</Btn>
                      </div>
                    )}
                  </>
                )}
              </div>
              )}
              {section === 'access' && (
              <div className="d-card" data-section="access">
                <div className="d-card__head">
                  <span className="d-card__title">{"Users & access"}</span>
                  <div className="spacer" />
                  {inviteLink
                    ? <a className="d-btn" style={{ height: '34px' }} href={inviteLink} data-testid="invite"><Ic n="user-plus" />{"Invite"}</a>
                    : <span style={{ fontSize: '13px', color: 'var(--text-3)' }} data-testid="invite">{"Your Lodestar admin adds store sign-ins."}</span>}
                </div>
                {people === null && <Skeleton rows={2} />}
                {people?.map(u => {
                  const [what, pill, cls] = roleOf(u.role);
                  return (
                    <div key={u.id} className="sx-set-row" data-user={u.id}>
                      <span className={u.self ? 'd-avatar' : 'sx-set-av'}>{initials(u.name)}</span>
                      <div className="sx-set-row__main">
                        <b>{u.name}</b>
                        <span>{what}</span>
                      </div>
                      {pill && <span className={`m-pill${cls ? ` ${cls}` : ''}`}>{pill}</span>}
                    </div>
                  );
                })}
                <div className="sx-set-row">
                  <span className="sx-set-av"><Ic n="grid" /></span>
                  <div className="sx-set-row__main">
                    <b>{"This browser"}</b>
                    <span>{session?.expiresAt ? `Signed in · session renews until ${fmtDayTime(new Date(session.expiresAt * 1000))}` : 'Signed in'}</span>
                  </div>
                  <Btn className="sx-link" style={{ fontSize: '13px' }} onClick={() => void logout()}>{"Sign out"}</Btn>
                </div>
              </div>
              )}
              {section === 'notifications' && (
              <div className="d-card" data-testid="store-notifications" data-section="notifications">
                <div className="d-card__head">
                  <span className="d-card__title">{"Notifications"}</span>
                  <div className="spacer" />
                  <span className="sx-col-h">{"App"}</span>
                  <span className="sx-col-h" title={smsOff}>{"SMS"}</span>
                </div>
                {smsOff && <div className="sx-set-row" data-testid="sms-unavailable"><div className="sx-set-row__main"><span>{`SMS: ${smsOff}`}</span></div></div>}
                {TOPICS.slice(0, 2).map(t => (
                  <div key={t.k} className="sx-set-row">
                    <div className="sx-set-row__main"><b>{t.label}</b><span>{t.sub}</span></div>
                    <div className="sx-col-h"><Tg label={`${t.label} app`} on={!!channels(t).app} onChange={draft ? v => setChannel(t, 'app', v) : undefined} /></div>
                    <div className="sx-col-h"><Tg label={`${t.label} SMS`} on={!!channels(t).sms} onChange={draft ? v => setChannel(t, 'sms', v) : undefined} unavailable={smsOff} /></div>
                  </div>
                ))}
                <div className="sx-set-row">
                  <div className="sx-set-row__main"><b>{"Short or moved orders"}</b><span>{smsOff ? 'always on in the app' : 'always on, both channels'}</span></div>
                  <div className="sx-col-h"><Tg label="Short or moved orders app" on locked /></div>
                  <div className="sx-col-h"><Tg label="Short or moved orders SMS" on locked unavailable={smsOff} /></div>
                </div>
                {TOPICS.slice(2).map(t => (
                  <div key={t.k} className="sx-set-row">
                    <div className="sx-set-row__main"><b>{t.label}</b><span>{t.sub}</span></div>
                    <div className="sx-col-h"><Tg label={`${t.label} app`} on={!!channels(t).app} onChange={draft ? v => setChannel(t, 'app', v) : undefined} /></div>
                    <div className="sx-col-h"><Tg label={`${t.label} SMS`} on={!!channels(t).sms} onChange={draft ? v => setChannel(t, 'sms', v) : undefined} unavailable={smsOff} /></div>
                  </div>
                ))}
              </div>
              )}
              {section === 'language' && (
              <div className="d-card" data-section="language">
                <div className="d-card__head"><span className="d-card__title">{"Language"}</span></div>
                <div className="d-card__body">
                  <div className="m-seg" style={{ margin: '0' }} role="radiogroup" aria-label="Language">
                    {LANGS.map(([k, label, cls]) => (
                      <span key={k} className={`m-seg__i${cls}${lang === k ? ' is-on' : ' lv-click'}`} role="radio" aria-checked={lang === k} tabIndex={0}
                        onClick={e => { e.stopPropagation(); setDraft(d => ({ ...(d ?? {}), language: k })); }}
                        onKeyDown={e => { if (e.key === 'Enter') setDraft(d => ({ ...(d ?? {}), language: k })); }}>
                        {label}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{`For this desk${staffFrom ? ` · staff at the door from ${clock(staffFrom)}` : ''}. Staff phones keep their own setting.`}</span>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
