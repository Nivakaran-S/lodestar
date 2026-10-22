'use client';
// DSP-04's map: a schematic of the run drawn as SVG (no map tiles, so nothing to load from a third-party host and
// nothing for the CSP to block). Depots, outlets and routes are placed by their coordinates; where a depot or outlet
// has none (the live registry often has lat/lng null), by its district's centre, an outlet spread around it by its
// id so stops of one district do not sit on top of each other. Positions placed that way are flagged "approximate".
// A route runs depot → stops in sequence; the van sits at the last stop it reached (the depot before the first),
// dashed and grey when its signal is lost (shown as predicted, never as live).
import { useMemo } from 'react';
import type { DepotRow, Outlet, Trip } from '@/lib/odata/types';

export interface LatLng { lat: number; lng: number }

/** District centres (main town), Sri Lanka. Keys are lower-case district names. */
export const DISTRICT_CENTRES: Record<string, LatLng> = {
  colombo: { lat: 6.927, lng: 79.861 },
  gampaha: { lat: 7.091, lng: 79.999 },
  kalutara: { lat: 6.585, lng: 79.96 },
  kandy: { lat: 7.291, lng: 80.634 },
  matale: { lat: 7.467, lng: 80.623 },
  'nuwara eliya': { lat: 6.97, lng: 80.783 },
  galle: { lat: 6.053, lng: 80.221 },
  matara: { lat: 5.948, lng: 80.535 },
  hambantota: { lat: 6.124, lng: 81.119 },
  jaffna: { lat: 9.661, lng: 80.026 },
  kilinochchi: { lat: 9.394, lng: 80.399 },
  mannar: { lat: 8.977, lng: 79.904 },
  vavuniya: { lat: 8.751, lng: 80.497 },
  mullaitivu: { lat: 9.267, lng: 80.814 },
  batticaloa: { lat: 7.731, lng: 81.674 },
  ampara: { lat: 7.297, lng: 81.682 },
  trincomalee: { lat: 8.587, lng: 81.215 },
  kurunegala: { lat: 7.487, lng: 80.365 },
  puttalam: { lat: 8.036, lng: 79.828 },
  anuradhapura: { lat: 8.312, lng: 80.413 },
  polonnaruwa: { lat: 7.94, lng: 81.0 },
  badulla: { lat: 6.99, lng: 81.055 },
  monaragala: { lat: 6.872, lng: 81.351 },
  moneragala: { lat: 6.872, lng: 81.351 },
  ratnapura: { lat: 6.683, lng: 80.399 },
  kegalle: { lat: 7.251, lng: 80.347 },
};

/** Where the two depots of the seed sit, for a registry row without coordinates or a known district. */
const DEPOT_FALLBACK: Record<string, LatLng> = {
  PELIYAGODA: { lat: 6.965, lng: 79.905 },
  KANDY: { lat: 7.29, lng: 80.635 },
};

const hasLatLng = (v: { lat?: number | null; lng?: number | null } | undefined): v is { lat: number; lng: number } =>
  !!v && typeof v.lat === 'number' && typeof v.lng === 'number' && Number.isFinite(v.lat) && Number.isFinite(v.lng) && !(v.lat === 0 && v.lng === 0);

export const districtCentre = (district: string | null | undefined): LatLng | undefined =>
  district ? DISTRICT_CENTRES[district.trim().toLowerCase().replace(/\s+district$/, '')] : undefined;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A point spread around `c` by the id (up to ~6 km), the same every render. */
function spread(c: LatLng, id: string, radius = 0.055): LatLng {
  const h = hash(id);
  const a = ((h % 360) * Math.PI) / 180;
  const r = radius * (0.35 + ((h >>> 9) % 100) / 154);
  return { lat: c.lat + r * Math.sin(a), lng: c.lng + r * Math.cos(a) };
}

interface Placed extends LatLng { approx: boolean }

export function depotPosition(code: string, row: Pick<DepotRow, 'lat' | 'lng' | 'district'> | undefined): Placed | undefined {
  if (hasLatLng(row ?? undefined)) return { lat: row!.lat!, lng: row!.lng!, approx: false };
  const c = DEPOT_FALLBACK[code.toUpperCase()] ?? districtCentre(row?.district);
  return c ? { ...c, approx: true } : undefined;
}

export function outletPosition(
  id: string,
  outlet: Pick<Outlet, 'lat' | 'lng' | 'district'> | undefined,
  fallbackDistrict: string | undefined,
  depot: LatLng | undefined,
): Placed | undefined {
  if (hasLatLng(outlet)) return { lat: outlet.lat!, lng: outlet.lng!, approx: false };
  const c = districtCentre(outlet?.district) ?? districtCentre(fallbackDistrict);
  if (c) return { ...spread(c, id), approx: true };
  // no district we know: around the depot, further out
  return depot ? { ...spread(depot, id, 0.25), approx: true } : undefined;
}

const W = 1000;
const H = 640;
const PAD = 70;

export interface OpsMapProps {
  trips: Trip[];
  depotRow(code: string): Pick<DepotRow, 'lat' | 'lng' | 'district' | 'name'> | undefined;
  outlets: ReadonlyMap<string, Pick<Outlet, 'lat' | 'lng' | 'district' | 'name'>>;
  selectedId?: string;
  onSelect(tripId: string): void;
  /** Late-risk alert level (%); undefined while unknown. */
  risk: number | undefined;
  /** Trips whose vehicle has lost its signal. */
  offline: ReadonlySet<string>;
  /** Space the route drawer takes at the bottom of the panel (px): the drawing sits above it. */
  bottomInset?: number;
}

const COLOR = { route: '#0369A1', risk: '#F5B83D', exception: '#B42318', done: '#047857', offline: '#57534E', planned: '#7C88D8' };

export default function OpsMap({ trips, depotRow, outlets, selectedId, onSelect, risk, offline, bottomInset = 0 }: OpsMapProps) {
  const model = useMemo(() => {
    const depots = new Map<string, Placed>();
    for (const t of trips) {
      if (!depots.has(t.depot)) {
        const p = depotPosition(t.depot, depotRow(t.depot));
        if (p) depots.set(t.depot, p);
      }
    }
    const routes = trips.map(t => {
      const depot = depots.get(t.depot);
      const stops = [...(t.stops ?? [])].sort((a, b) => a.stopSeq - b.stopSeq).map(s => {
        const pos = outletPosition(s.outletId, outlets.get(s.outletId), t.district, depot);
        return { s, pos };
      });
      return { t, depot, stops };
    });
    const pts: LatLng[] = [...depots.values(), ...routes.flatMap(r => r.stops.map(x => x.pos).filter((p): p is Placed => !!p))];
    const approx = [...depots.values()].some(p => p.approx) || routes.some(r => r.stops.some(x => x.pos?.approx));
    const districts = [...new Set(trips.map(t => t.district))]
      .map(d => ({ name: d, c: districtCentre(d) }))
      .filter((d): d is { name: string; c: LatLng } => !!d.c);
    return { depots, routes, pts, approx, districts };
  }, [trips, depotRow, outlets]);

  const project = useMemo(() => {
    const pts = model.pts;
    if (!pts.length) return null;
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const xs = pts.map(p => p.lng * k);
    const ys = pts.map(p => p.lat);
    let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // at least ~25 km across, so one depot and a few stops do not fill the panel
    const min = 0.22;
    if (x1 - x0 < min) { const m = (x0 + x1) / 2; x0 = m - min / 2; x1 = m + min / 2; }
    if (y1 - y0 < min) { const m = (y0 + y1) / 2; y0 = m - min / 2; y1 = m + min / 2; }
    const top = 64; // under the legend
    const h = H - top - PAD;
    const s = Math.min((W - 2 * PAD) / (x1 - x0), h / (y1 - y0));
    const ox = (W - (x1 - x0) * s) / 2;
    const oy = top + (h - (y1 - y0) * s) / 2;
    return (p: LatLng) => ({ x: ox + (p.lng * k - x0) * s, y: oy + (y1 - p.lat) * s });
  }, [model.pts]);

  if (!project) {
    return (
      <div className="lv-map-empty" data-testid="ops-map" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '14px' }}>
        {trips.length ? 'No position known for these routes yet.' : 'No routes to draw for this run.'}
      </div>
    );
  }

  const ordered = [...model.routes].sort((a, b) => Number(a.t.id === selectedId) - Number(b.t.id === selectedId));
  return (
    <svg
      data-testid="ops-map"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: bottomInset, width: '100%', height: `calc(100% - ${bottomInset}px)` }}
      fontFamily="Inter, sans-serif"
      role="img"
      aria-label={`Map of ${trips.length} routes`}
    >
      <rect x={0} y={0} width={W} height={H} fill="#E8EEF2" />
      {model.districts.map(d => {
        const p = project(d.c);
        return (
          <g key={d.name} opacity={0.9}>
            <ellipse cx={p.x} cy={p.y} rx={70} ry={42} fill="#3B4CCA" fillOpacity={0.05} stroke="#3B4CCA" strokeOpacity={0.2} strokeDasharray="4 3" />
            <text x={p.x} y={p.y - 48} textAnchor="middle" fontSize={15} fontWeight={700} fill="#8A93A6">{d.name}</text>
          </g>
        );
      })}
      {ordered.map(({ t, depot, stops }) => {
        const sel = t.id === selectedId;
        const remaining = t.stops?.filter(s => !['DELIVERED', 'CANCELLED'].includes(s.status)) ?? [];
        const maxRisk = Math.max(0, ...remaining.map(s => s.lateRiskPct ?? 0));
        const exc = (t.stops ?? []).some(s => s.status === 'EXCEPTION');
        const lost = offline.has(t.id);
        const color = exc ? COLOR.exception : lost ? COLOR.offline : t.status === 'COMPLETE' ? COLOR.done
          : risk !== undefined && remaining.length && maxRisk >= risk ? COLOR.risk : t.status === 'PLANNED' || t.status === 'LOADING' ? COLOR.planned : COLOR.route;
        const path = [depot, ...stops.map(x => x.pos)].filter((p): p is Placed => !!p).map(project);
        if (t.status === 'COMPLETE' && depot) path.push(project(depot));
        // the van: at the last stop reached (the depot before the first); none before it leaves or after it is back
        const lastDone = [...stops].reverse().find(x => x.s.status === 'DELIVERED' && x.pos);
        const van = t.status === 'ENROUTE' ? (lastDone?.pos ?? depot) : undefined;
        const vp = van ? project(van) : undefined;
        const pts = path.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        return (
          <g key={t.id} data-map-trip={t.id} style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onSelect(t.id); }} opacity={selectedId && !sel ? 0.55 : 1}>
            <title>{`${t.vehicleId} · ${t.district} · trip ${t.tripNumber}`}</title>
            {path.length > 1 && (
              <polyline points={pts} fill="none" stroke={color} strokeWidth={sel ? 5 : 3} strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={lost || t.status === 'PLANNED' || t.status === 'LOADING' ? '7 6' : undefined} />
            )}
            {stops.map(({ s, pos }) => {
              if (!pos) return null;
              const p = project(pos);
              const fill = s.status === 'DELIVERED' ? COLOR.done : s.status === 'EXCEPTION' ? COLOR.exception : '#FFFFFF';
              return (
                <g key={s.id} data-map-stop={s.id}>
                  <circle cx={p.x} cy={p.y} r={sel ? 7 : 5.5} fill={fill} stroke="#0F1422" strokeWidth={2} strokeDasharray={pos.approx ? '2 2' : undefined} />
                  {sel && <text x={p.x + 11} y={p.y + 5} fontSize={14} fontWeight={700} fill="#0F1422" fontFamily="JetBrains Mono, monospace">{s.outletId}</text>}
                </g>
              );
            })}
            {vp && (
              <g data-map-van={t.vehicleId}>
                <circle cx={vp.x} cy={vp.y} r={9} fill={lost ? '#FFFFFF' : color} stroke={lost ? COLOR.offline : '#FFFFFF'} strokeWidth={2.5} strokeDasharray={lost ? '3 2' : undefined} />
                <rect x={vp.x + 12} y={vp.y - 12} width={lost ? 150 : 74} height={24} rx={12} fill={lost ? '#FFFFFF' : color} stroke={lost ? COLOR.offline : 'none'} strokeDasharray={lost ? '3 2' : undefined} />
                <text x={vp.x + 12 + (lost ? 75 : 37)} y={vp.y + 5} textAnchor="middle" fontSize={13} fontWeight={800} fill={lost ? COLOR.offline : color === COLOR.risk ? '#1A1300' : '#FFFFFF'} fontFamily="JetBrains Mono, monospace">
                  {lost ? `${t.vehicleId} predicted` : t.vehicleId}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {[...model.depots.entries()].map(([code, p]) => {
        const q = project(p);
        return (
          <g key={code} data-map-depot={code}>
            <g transform={`translate(${q.x - 13},${q.y - 13})`}>
              <rect width={26} height={26} rx={7} fill="#141B4D" />
              <path d="M6 21V10l7-4 7 4v11" fill="none" stroke="#F5B83D" strokeWidth={2} />
            </g>
            <text x={q.x + 18} y={q.y + 5} fontSize={15} fontWeight={800} fill="#141B4D">{depotRow(code)?.name ?? code}</text>
          </g>
        );
      })}
      {model.approx && (
        <text x={W - 16} y={H - 12} textAnchor="end" fontSize={12} fill="#6B7280" data-testid="map-approx">
          Schematic · positions without coordinates placed by district
        </text>
      )}
    </svg>
  );
}
