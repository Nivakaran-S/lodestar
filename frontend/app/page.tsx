// The start page: Waypoint Group's front door to Lodestar. One URL, every role. Each role opens that role's app on
// this origin: the desk faces (/store, /plan, /admin) and the field app's browser build (/field/, Dock and Run, sized
// for a phone). Face logos and colours come from the design (Designing/assets/face-logos.html); brand colours from
// styles/tokens.css. Network figures are the brief's shared datasets (outlets.csv, vehicles.csv).
import Link from "next/link";
import type { ReactNode } from "react";
import "./styles/home.css";

// The password hint is read per request from the container's environment (docker-compose.yml): the dev defaults
// locally, the deployment's persona password on the demo VM. The admin password is never shown there.
export const dynamic = "force-dynamic";

type Role = {
  key: string;
  face: string;
  role: string;
  text: string;
  /** The role's sign-in on this website; none for Lodestar Run, which is an Android app only. */
  href?: string;
  persona: string;
  color: string;
  device: string;
  icon: ReactNode;
  also?: { label: string; href: string };
};

const ROLES: Role[] = [
  {
    key: "store", face: "Lodestar Store", role: "Store manager", text: "Place tomorrow's order before 4 PM, follow the arrival time, confirm what arrived.",
    href: "/store/sm-26-sign-in", persona: "77 456 7890 + code", color: "#047857", device: "Desktop or phone",
    icon: <><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M5 13v8h14v-8M10 21v-5h4v5" /></>,
    also: { label: "Phone app", href: "/field/s/sm-05-sign-in" },
  },
  {
    key: "plan", face: "Lodestar Plan", role: "Dispatcher", text: "Allocate orders to vehicles and trips with the planning agent, explain every deferral, watch the run live.",
    href: "/plan/dsp-06-sign-in", persona: "nilanthi@waypoint.lk", color: "#3B4CCA", device: "Planning office",
    icon: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  },
  {
    key: "dock", face: "Lodestar Dock", role: "Loader", text: "Load in reverse stop order, flag short or damaged items, release the vehicle with its seal.",
    href: "/field/s/ld-06-sign-in", persona: "KDY-0427 · PIN 2468", color: "#6D28D9", device: "Phone or dock tablet",
    icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></>,
  },
  {
    key: "run", face: "Lodestar Run", role: "Driver", text: "Follow the route and record every stop with proof of delivery, even with no signal. Runs on the driver's Android phone, not in the browser.",
    persona: "77 345 6789 + code", color: "#0369A1", device: "Android app",
    icon: <path d="m3 11 19-9-9 19-2-8-8-2z" />,
  },
];

const ADMIN: Role = {
  key: "admin", face: "Lodestar Admin", role: "Admin", text: "People, phones, outlets, vehicles, data imports and the audit log.",
  href: "/admin/adm-01-sign-in", persona: "admin", color: "#334155", device: "Head office",
  icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
};

const BRANDS: { key: string; name: string; outlets: number; goods: string; schedule: string; icon: ReactNode }[] = [
  {
    key: "fresh", name: "Waypoint Fresh", outlets: 80, goods: "Groceries, chilled and frozen", schedule: "Daily, before 8 AM",
    icon: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
  },
  {
    key: "style", name: "Waypoint Style", outlets: 25, goods: "Hanging garments and cartons", schedule: "Weekly, seasonal peaks",
    icon: <path d="M12 6a2 2 0 1 1 2-2c0 1.1-.9 2-2 2.6V8l9 7a1.5 1.5 0 0 1-.9 2.7H3.9A1.5 1.5 0 0 1 3 15l9-7" />,
  },
  {
    key: "tech", name: "Waypoint Tech", outlets: 15, goods: "Appliances and electronics", schedule: "As needed, fragile",
    icon: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  },
];

const NETWORK: { value: string; label: string }[] = [
  { value: "120", label: "Outlets" },
  { value: "2", label: "Depots" },
  { value: "60", label: "Vehicles" },
  { value: "16", label: "Refrigerated" },
];

const FLOW: { step: string; who: string; color: string }[] = [
  { step: "Order", who: "Store manager", color: "#047857" },
  { step: "Plan", who: "Dispatcher", color: "#3B4CCA" },
  { step: "Load", who: "Loader", color: "#6D28D9" },
  { step: "Deliver", who: "Driver", color: "#0369A1" },
  { step: "Confirm", who: "Store manager", color: "#047857" },
];

function Icon({ color, size = 44, children }: { color: string; size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="9" fill={color} />
      <g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{children}</g>
    </svg>
  );
}

function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#141B4D" />
      <path d="M16 4 L18.6 13.4 L28 16 L18.6 18.6 L16 28 L13.4 18.6 L4 16 L13.4 13.4 Z" fill="#F5B83D" />
      <circle cx="16" cy="16" r="2.2" fill="#141B4D" />
    </svg>
  );
}

/** The desk faces are routes of this app; the field app (/field/) is another app on the same origin. */
function Go({ href, className, label, children }: { href: string; className: string; label?: string; children: ReactNode }) {
  if (href.startsWith("/field/")) return <a href={href} className={className} aria-label={label}>{children}</a>;
  return <Link href={href} className={className} aria-label={label}>{children}</Link>;
}

function RoleCard({ r, compact = false }: { r: Role; compact?: boolean }) {
  const head = (
    <>
      <Icon color={r.color} size={compact ? 40 : 44}>{r.icon}</Icon>
      <span className="hm-card__titles">
        <b>{r.role}</b>
        <span>{r.face}</span>
      </span>
      <span className="hm-card__device">{r.device}</span>
    </>
  );
  return (
    <div className={`hm-card${compact ? " hm-card--compact" : ""}`} data-role={r.key} style={{ ["--role" as string]: r.color }}>
      {r.href
        ? <Go href={r.href} className="hm-card__head" label={`${r.role}: ${r.face}`}>{head}</Go>
        : <div className="hm-card__head" aria-label={`${r.role}: ${r.face}`}>{head}</div>}
      <p className="hm-card__desc">{r.text}</p>
      <div className="hm-card__foot">
        <span className="hm-card__persona">Sign in with <code>{r.persona}</code></span>
        <span className="hm-card__actions">
          {r.also && <Go href={r.also.href} className="hm-card__also">{r.also.label}</Go>}
          {r.href
            ? <Go href={r.href} className="hm-card__cta">Open <span aria-hidden="true">→</span></Go>
            : <span className="hm-card__also">On the phone</span>}
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const personaPassword = process.env.DEMO_PASSWORD_HINT?.trim();
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD_HINT?.trim();

  return (
    <main className="hm">
      <header className="hm-top">
        <div className="hm-wrap hm-top__row">
          <span className="hm-top__brand"><Mark size={28} /><b>Waypoint Lodestar</b></span>
          <nav className="hm-top__nav" aria-label="Page">
            <a href="#roles">Roles</a>
            <a href="#flow">How it works</a>
            <a href="#network">Network</a>
          </nav>
        </div>
      </header>

      <section className="hm-hero">
        <div className="hm-wrap hm-hero__grid">
          <div className="hm-hero__copy">
            <p className="hm-eyebrow">Waypoint Group · Delivery operations</p>
            <h1>Waypoint Lodestar</h1>
            <p className="hm-hero__tag">Every order, one thread.</p>
            <p className="hm-hero__lede">
              From the store&apos;s order to the signed receipt: one platform plans the day, loads the vehicles and
              tracks every delivery across Peliyagoda and Kandy, online or off.
            </p>
            <div className="hm-hero__ctas">
              <a href="#roles" className="hm-btn hm-btn--primary">Choose your role</a>
              <a href="#flow" className="hm-btn hm-btn--ghost">See how an order moves</a>
            </div>
          </div>
          <ul className="hm-hero__stats" id="network" aria-label="The network">
            {NETWORK.map(n => (
              <li key={n.label}><b>{n.value}</b><span>{n.label}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="hm-wrap hm-section" id="roles" aria-labelledby="roles-title">
        <div className="hm-section__head">
          <h2 id="roles-title">Choose your role</h2>
          <p>Each role signs in to its own app. The Dock works on a phone, a bay tablet or any browser; Lodestar Run is the driver&apos;s Android app.</p>
        </div>
        <nav className="hm-grid" aria-label="Roles">
          {ROLES.map(r => <RoleCard key={r.key} r={r} />)}
        </nav>
        <div className="hm-admin">
          <RoleCard r={ADMIN} compact />
        </div>
      </section>

      <section className="hm-band" id="flow" aria-labelledby="flow-title">
        <div className="hm-wrap">
          <div className="hm-section__head">
            <h2 id="flow-title">One thread, five hand-offs</h2>
            <p>Every role sees the same order, and every hand-off is recorded.</p>
          </div>
          <ol className="hm-flow" aria-label="How an order moves">
            {FLOW.map((f, i) => (
              <li key={f.step} style={{ ["--role" as string]: f.color }}>
                <span className="hm-flow__n">{i + 1}</span>
                <b>{f.step}</b>
                <span>{f.who}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="hm-wrap hm-section" aria-labelledby="brands-title">
        <div className="hm-section__head">
          <h2 id="brands-title">Three brands, one network</h2>
        </div>
        <ul className="hm-brands" aria-label="Brands">
          {BRANDS.map(b => (
            <li key={b.key} className="hm-brand" data-brand={b.key}>
              <span className="hm-brand__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{b.icon}</svg>
              </span>
              <span className="hm-brand__txt">
                <b>{b.name}</b>
                <span>{b.outlets} outlets · {b.goods}</span>
                <span>{b.schedule}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="hm-foot">
        <div className="hm-wrap hm-foot__row">
          <p>
            {personaPassword
              ? <>Store and driver: the code is shown on screen. Dispatcher password <code>{personaPassword}</code>{adminPassword && <> · admin <code>{adminPassword}</code></>}. </>
              : <>The demo accounts and passwords are in the README. </>}
            Waypoint Group is fictional and all data is synthetic.
          </p>
          <Link href="/screens">All design screens</Link>
        </div>
      </footer>
    </main>
  );
}
