// Settings and trust screens made live: SM-30 and DSP-20 settings (own preferences), DSP-07 2-step verification,
// DSP-15 late-risk explainer, DSP-16 models and fallbacks, ADM-14/15 data imports, ADM-17 agent guardrails; plus the
// design links restored on the sidebars. Real ODataClient over a fake fetch. Written, not run (tests paused).
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { AdminSide, PlanSide } from '@/components/live/chrome';
import { type DataImport, importFileOf, type Preferences, readText } from '@/components/live/settings-data';
import Imports from '@/live/adm-14-data-imports';
import ImportFailed, { rejectedCsv } from '@/live/adm-15-import-check-failed';
import AuditLog from '@/live/adm-16-audit-log';
import Guardrails from '@/live/adm-17-planning-agent-guardrails';
import TwoStep, { accountSecurityUrl } from '@/live/dsp-07-2-step-verification';
import LateRisk from '@/live/dsp-15-late-risk-explainer';
import Models from '@/live/dsp-16-models-and-fallbacks';
import PlanSettings from '@/live/dsp-20-settings';
import StoreSettings from '@/live/sm-30-settings';
import { freezeDate, unfreeze } from './helpers/clock';
import type { FakeRequest } from './helpers/live';
import { page, PLANNING_RULES, renderLive, SESSIONS } from './helpers/live';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/plan' }));

const CONFIG = {
  model: { setting: 'mock', provider: 'mock', label: 'Deterministic built-in model', configured: true, deployment: null, endpointHost: null, missing: [] },
  fallback: 'Manual plan board', humanApproval: true, canPublish: false, maxRedrafts: 3, firstDeparture: '03:30',
  limits: { maxTripsPerVehicle: 2, freshMinutesBudget: 270, otherMinutesBudget: 480, protectedScore: 91, deferralCandidateBelow: 30, defaultServiceMin: 15 },
  rules: [{ rule: 'weight', label: 'Weight' }, { rule: 'volume', label: 'Volume' }],
  reasonCodes: ['CAP_REEFER', 'CAP_TIME', 'ACCESS', 'WINDOW', 'FUEL', 'VEH_DOWN'],
  reads: ['Calendar', 'DistrictTravel', 'Orders', 'Outlets', 'ServiceAllowances', 'Vehicles'],
  askTools: [], decisions: ['approve', 'edit', 'reject'], decidedBy: 'dispatcher',
};
const failed = {
  id: 'imp-9', file: 'outlets', fileName: 'outlets_2026-04-07.csv', rows: 120, passed: 118, applied: false, created: 0, updated: 0,
  problems: [{ row: 89, key: 'OUT088', column: 'parking_constraint', value: 'vans', reason: 'Lodestar reads only normal, van_only or mall_dock (with an underscore).' }],
  checks: [{ label: 'Every outlet_id appears once', passed: true, detail: '120 distinct' }], importedBy: 'u-a', byName: 'Ada Admin', importedAt: '2026-04-06T04:55:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/plan');
  freezeDate('2026-04-06T08:00:00.000Z');
});
afterEach(unfreeze);

type SaveBody = { preferences: Preferences & { notifications: Record<string, unknown>; alerts: Record<string, unknown> } };

const fallback = (req: FakeRequest) => (req.query.$top === '0' ? page([], 0) : page([]));
/** Notifications/Lodestar.Channels on a deployment with SMS_ENABLED=true. */
const SMS_ON = { value: { websocket: true, push: false, sms: true, call: false } };

describe('sidebars carry the designed links again', () => {
  it('Plan has N8 Intelligence and N9 Settings; Admin has N8 Data imports and N10 Planning agent', () => {
    renderLive(<><PlanSide active="N0" /><AdminSide active="N0" /></>, { handler: fallback });
    expect(screen.getByText('Intelligence').closest('[data-lk]')).toHaveAttribute('data-lk', 'N8');
    expect(screen.getByText('Settings').closest('[data-lk]')).toHaveAttribute('data-lk', 'N9');
    expect(screen.getByText('Data imports').closest('[data-lk]')).toHaveAttribute('data-lk', 'N8');
    expect(screen.getByText('Planning agent').closest('[data-lk]')).toHaveAttribute('data-lk', 'N10');
  });
});

describe('SM-30 Settings', () => {
  it('each tab shows its own section, one at a time', async () => {
    renderLive(<StoreSettings />, { session: SESSIONS.store, handler: req => (req.path.includes('MyPreferences') ? { value: {} } : fallback(req)) });
    const shown = () => [...document.querySelectorAll('[data-section]')].map(e => e.getAttribute('data-section'));
    expect(shown()).toEqual(['store']);
    for (const [tab, key] of [[/Receiving/, 'receiving'], [/Notifications/, 'notifications'], [/Users & access/, 'access'], [/Language/, 'language'], [/Store details/, 'store']] as const) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      expect(shown()).toEqual([key]);
      expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    }
  });

  it('loads the manager’s preferences, toggles SMS for "Van on the way" and saves only own sections', async () => {
    const view = renderLive(<StoreSettings />, {
      session: SESSIONS.store,
      handler: req => req.path.includes('SaveMyPreferences') ? { value: (req.body as { preferences: unknown }).preferences }
        : req.path.includes('MyPreferences') ? { value: { language: 'si' } }
          : req.path.includes('Lodestar.Channels') ? SMS_ON
          : req.path.startsWith("Outlets('OUTT01')") ? { id: 'OUTT01', name: 'Waypoint Fresh Test', brand: 'FRESH', depot: 'KANDY', dockType: 'REAR_DOCK', parking: 'NORMAL', windowOpen: '05:30', windowClose: '08:00', accessNote: 'Lawson St lane' }
            : fallback(req),
    });
    // Store details is the first tab; the others open from the tab list, and edits survive switching tabs
    expect(await screen.findByText('Lawson St lane')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Notifications/ }));
    fireEvent.click(screen.getByLabelText('Van on the way SMS'));
    fireEvent.click(screen.getByText('Save changes'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/store/sm-02-deliveries'));
    const save = view.calls.find(c => c.path.includes('SaveMyPreferences'))!;
    expect(save.method).toBe('POST');
    expect((save.body as SaveBody).preferences.notifications.vanOnTheWay).toEqual({ app: true, sms: true });
    expect((save.body as SaveBody).preferences.language).toBe('si');
  });

  it('lists the outlet’s sign-ins from the directory (Users/Lodestar.MyOutletUsers), the manager first', async () => {
    const view = renderLive(<StoreSettings />, {
      session: SESSIONS.store,
      handler: req => req.path.includes('MyOutletUsers')
        ? { value: [{ id: 'u-s', name: 'Sam Store', role: 'STORE_MANAGER', self: true }, { id: 'u-r', name: 'Rita Receiver', role: 'STORE_MANAGER', self: false }] }
        : req.path.includes('MyPreferences') ? { value: {} } : fallback(req),
    });
    fireEvent.click(screen.getByRole('tab', { name: /Users & access/ }));
    expect(await screen.findByText('Rita Receiver')).toBeInTheDocument();
    expect(view.calls.some(c => c.method === 'GET' && c.path.includes('Users/Lodestar.MyOutletUsers'))).toBe(true);
    const rows = document.querySelectorAll('[data-user]');
    expect([...rows].map(r => r.getAttribute('data-user'))).toEqual(['u-s', 'u-r']);
    expect(rows[0].querySelector('.d-avatar')).toHaveTextContent('SS');
    expect(screen.getAllByText('Owner')).toHaveLength(2);
  });

  it('shows only the signed-in manager when the directory has nobody for the outlet', async () => {
    renderLive(<StoreSettings />, { session: SESSIONS.store, handler: req => (req.path.includes('MyPreferences') ? { value: {} } : fallback(req)) });
    fireEvent.click(screen.getByRole('tab', { name: /Users & access/ }));
    await waitFor(() => expect(document.querySelectorAll('[data-user]')).toHaveLength(1));
    expect(document.querySelector('[data-user="u-s"]')).toHaveTextContent('Sam Store');
  });
});

describe('SMS is offered only when the deployment sends it (SMS_ENABLED)', () => {
  const off = (req: FakeRequest) => req.path.includes('MyPreferences') ? { value: {} }
    : req.path.includes('Lodestar.Channels') ? { value: { websocket: true, push: false, sms: false, call: false } }
      : req.path.includes('AgentConfig') ? { value: CONFIG } : fallback(req);

  it('SM-30 shows the SMS switches off and disabled, with the reason', async () => {
    renderLive(<StoreSettings />, { session: SESSIONS.store, handler: off });
    fireEvent.click(screen.getByRole('tab', { name: /Notifications/ }));
    expect(await screen.findByTestId('sms-unavailable')).toHaveTextContent('Not available in this deployment');
    const sw = screen.getByLabelText('Van on the way SMS');
    expect(sw).toHaveAttribute('aria-disabled', 'true');
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('DSP-20 shows the vehicle-fault SMS switch disabled and no call switch', async () => {
    renderLive(<PlanSettings />, { handler: off });
    expect(await screen.findByTestId('sms-unavailable')).toHaveTextContent('Not available in this deployment');
    expect(screen.getByLabelText('Vehicle fault SMS')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByLabelText('Silence call')).not.toBeInTheDocument();
  });
});

describe('DSP-20 Settings', () => {
  it('shows the agent’s limits and reason codes and saves the dispatcher’s alert rules', async () => {
    const view = renderLive(<PlanSettings />, {
      handler: req => req.path.includes('SaveMyPreferences') ? { value: (req.body as { preferences: unknown }).preferences }
        : req.path.includes('MyPreferences') ? { value: {} }
          : req.path.includes('Lodestar.Channels') ? SMS_ON
            : req.path.includes('AgentConfig') ? { value: CONFIG } : fallback(req),
    });
    expect(await screen.findByText('3:30 to 8:00 · 270 min')).toBeInTheDocument();
    expect(screen.getByTestId('reason-codes')).toHaveTextContent('CAP_REEFER');
    // no call channel: there is no voice provider
    expect(screen.queryByLabelText('Silence call')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText('Vehicle fault SMS'));
    fireEvent.click(screen.getByText('Save changes'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/plan/dsp-08-today-overview'));
    const save = view.calls.find(c => c.path.includes('SaveMyPreferences'))!;
    expect((save.body as SaveBody).preferences.alerts.vehicleFault).toEqual({ push: true, sms: false });
    // no on-call hours were set, so none are invented and saved
    expect(save.body).not.toHaveProperty('preferences.onCall');
    expect(screen.getByLabelText('On call from')).toHaveValue('');
  });

  it('shows and saves the on-call hours the dispatcher has saved', async () => {
    const view = renderLive(<PlanSettings />, {
      handler: req => req.path.includes('SaveMyPreferences') ? { value: (req.body as { preferences: unknown }).preferences }
        : req.path.includes('MyPreferences') ? { value: { onCall: { from: '22:00', to: '06:00' } } }
          : req.path.includes('AgentConfig') ? { value: CONFIG } : fallback(req),
    });
    expect(await screen.findByLabelText('On call from')).toHaveValue('22:00');
    fireEvent.change(screen.getByLabelText('On call to'), { target: { value: '05:30' } });
    fireEvent.click(screen.getByText('Save changes'));
    await waitFor(() => expect(view.calls.some(c => c.path.includes('SaveMyPreferences'))).toBe(true));
    const save = view.calls.find(c => c.path.includes('SaveMyPreferences'))!;
    expect((save.body as { preferences: { onCall: unknown } }).preferences.onCall).toEqual({ from: '22:00', to: '05:30' });
  });
});

describe('DSP-07 2-step verification', () => {
  it('shows the Keycloak status and links to the account console', async () => {
    renderLive(<TwoStep />, { handler: req => (req.path.includes('MyTwoFactor') ? { value: { available: true, enabled: true, setupRequired: false, otp: [{ label: 'Pixel', createdAt: '2026-03-01T00:00:00Z' }] } } : fallback(req)) });
    expect(await screen.findByText('2-step verification is on')).toBeInTheDocument();
    expect(screen.getByText('Continue to Lodestar Plan').closest('[data-lk]')).toHaveAttribute('data-lk', 'L146');
    expect(accountSecurityUrl('https://x/auth/realms/lodestar/')).toBe('https://x/auth/realms/lodestar/account/#/security/signingin');
  });
});

describe('DSP-15 Late-risk explainer', () => {
  const EXPLAIN = {
    stopId: 's2', depot: 'KANDY', roadClass: 'hill', monsoon: true, plannedHour: 5, windowClose: '07:45', lateRiskPct: 61, planned: 50, base: 20,
    parts: [
      { key: 'base', label: 'Base rate', detail: 'Monsoon hill road, planned before 6 AM', value: 20 },
      { key: 'window', label: 'Arrival near the window close', detail: 'Model ETA 7:28 is within 30 min of 7:45', value: 30 },
      { key: 'road', label: 'Updates on the road', detail: 'Re-estimated since the plan', value: 11 },
    ],
  };

  it('explains the riskiest open stop of the run with the planning service breakdown, and warns the store', async () => {
    const view = renderLive(<LateRisk />, {
      handler: req => req.path.includes('Lodestar.LateRiskExplain') ? { value: EXPLAIN }
        : req.path === 'Users' ? page([{ id: 'u-fm', name: 'Fathima' }])
          : req.path.includes('Lodestar.Send') ? { id: 'n1' }
            : req.path === 'Plans' ? page([{ runDate: '2026-04-07T00:00:00.000Z' }])
        : req.path === 'Trips' ? page([{ id: 't1', vehicleId: 'VEH057', tripNumber: 1, depot: 'KANDY', stops: [
          { id: 's1', orderId: 'o1', outletId: 'OUT106', stopSeq: 1, status: 'ENROUTE', lateRiskPct: 12, etaPlan: '2026-04-07T00:01:00Z', etaModel: '2026-04-07T01:05:00Z' },
          { id: 's2', orderId: 'o2', outletId: 'OUT108', stopSeq: 2, status: 'ENROUTE', lateRiskPct: 61, etaPlan: '2026-04-06T23:31:00Z', etaModel: '2026-04-07T01:58:00Z', etaModelBandEarly: '2026-04-07T01:40:00Z', etaModelBandLate: '2026-04-07T02:15:00Z' },
        ] }])
          : req.path.startsWith("Outlets('OUT108')") ? { id: 'OUT108', name: 'Waypoint Fresh Hawa Eliya', district: 'Nuwara Eliya', windowOpen: '05:30', windowClose: '07:45' }
            : fallback(req),
    });
    expect(await screen.findByText('Why OUT108 reads 61%')).toBeInTheDocument();
    expect(await screen.findByText('Base rate')).toBeInTheDocument();
    expect(screen.getByText('+11')).toBeInTheDocument();
    expect(view.calls.some(c => c.path.includes("Lodestar.LateRiskExplain(stopId='s2')"))).toBe(true);
    fireEvent.click(screen.getByTestId('warn-store'));
    await waitFor(() => expect(view.calls.some(c => c.path.includes('Lodestar.Send'))).toBe(true));
    const send = view.calls.find(c => c.path.includes('Lodestar.Send'))!;
    expect(send.body).toMatchObject({ recipientId: 'u-fm', type: 'DISPATCH_NOTICE', outletId: 'OUT108' });
  });
});

describe('DSP-20 Settings · planning rules', () => {
  it('shows the cut-off, score weights, protected score and alert choices the planning service serves, not copies', async () => {
    const rules = {
      ...PLANNING_RULES,
      cutoff: '15:30',
      deferral: { ...PLANNING_RULES.deferral, weights: { ...PLANNING_RULES.deferral.weights, deferredYesterday: 41, perDaySince: 7 }, protectedScore: 88 },
      lateRisk: { alertPct: 25, highPct: 55, thresholdOptions: [15, 25] },
      alertDefaults: { ...PLANNING_RULES.alertDefaults, lateRisk: { push: true, threshold: 25, risingOnly: true }, silence: { push: true, call: true, minutes: 9 } },
    };
    const view = renderLive(<PlanSettings />, {
      rules,
      handler: req => req.path.includes('MyPreferences') ? { value: {} } : req.path.includes('AgentConfig') ? { value: CONFIG } : fallback(req),
    });
    expect(await screen.findByText('3:30 PM')).toBeInTheDocument();
    expect(screen.getByText('15:30')).toBeInTheDocument();
    expect(screen.getByText('+41')).toBeInTheDocument();
    expect(screen.getByText('×7 a day')).toBeInTheDocument();
    expect(screen.getByText(/score 88 or more is never deferred/)).toBeInTheDocument();
    expect(await screen.findByText('Silent 9 min, unknown place')).toBeInTheDocument();
    const select = screen.getByLabelText('Late risk threshold') as HTMLSelectElement;
    expect([...select.options].map(o => o.value)).toEqual(['15', '25']);
    expect(select.value).toBe('25');
    expect(screen.queryByText('+40')).not.toBeInTheDocument();
    expect(view.calls.some(c => c.path.includes('Lodestar.PlanningRules'))).toBe(true);
  });
});

describe('DSP-16 Models and fallbacks · validation', () => {
  it('shows each estimator’s measured value against its target, or "Not measured yet" with the reason', async () => {
    const rules = {
      ...PLANNING_RULES,
      models: {
        ...PLANNING_RULES.models,
        serviceTime: { target: PLANNING_RULES.modelTargets.serviceTime, measured: { value: 3.2, n: 55 } },
        lateness: { target: PLANNING_RULES.modelTargets.lateness, measured: { value: null, n: 4, reason: 'Needs both late and on-time arrivals (0 late, 4 on time so far)' } },
      },
    };
    renderLive(<Models />, { rules, handler: req => req.path.includes('AgentConfig') ? { value: CONFIG } : fallback(req) });
    expect(await screen.findByTestId('validation-serviceTime')).toHaveTextContent('MAE 3.2 min a stop over 55 stops target ≤ 4');
    expect(screen.getByTestId('validation-lateness')).toHaveTextContent('Not measured yet · target ≥ 0.80');
    expect(screen.getByTestId('validation-lateness')).toHaveTextContent('0 late, 4 on time so far');
    expect(screen.getByTestId('validation-demand')).toHaveTextContent('Not measured yet · target ≤ 12');
    expect(screen.queryByText(/illustrative/)).not.toBeInTheDocument();
    expect(screen.getByText('3 models + planning agent, each with a fallback')).toBeInTheDocument();
  });
});

describe('DSP-16 Models and fallbacks', () => {
  it('shows the agent model from the config endpoint and the calendar horizon', async () => {
    renderLive(<Models />, {
      handler: req => req.path.includes('AgentConfig') ? { value: CONFIG }
        : req.path === 'Calendar' && req.query.$top === '1' ? page([{ date: '2026-06-28T00:00:00.000Z' }])
          : req.path === 'ServiceAllowances' ? page([{ brand: 'FRESH', dockType: 'REAR_DOCK', minutes: 15 }]) : fallback(req),
    });
    expect(await screen.findByText(/Deterministic built-in model/)).toBeInTheDocument();
    expect(await screen.findByTestId('horizon')).toHaveTextContent('(W26)');
  });
});

describe('ADM-14 Data imports', () => {
  it('lists the files with their row counts and sends a picked CSV to DataImports/Lodestar.Import', async () => {
    const view = renderLive(<Imports />, {
      session: SESSIONS.admin,
      handler: req => req.path.includes('Lodestar.Import') ? { ...failed, applied: true, problems: [], created: 1, updated: 119 }
        : req.path === 'Outlets' && req.query.$top === '0' ? page([], 120) : fallback(req),
    });
    expect(await screen.findByTestId('file-outlets')).toHaveTextContent('120');
    const file = new File(['outlet_id,brand\nOUT1,fresh\n'], 'outlets.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });
    fireEvent.click(await screen.findByText('Check and import'));
    expect(await screen.findByTestId('import-done')).toHaveTextContent('1 new, 119 updated');
    const call = view.calls.find(c => c.path.includes('Lodestar.Import'))!;
    expect(call.body).toMatchObject({ file: 'outlets', fileName: 'outlets.csv' });
    expect(importFileOf('district_travel_v2.csv')).toBe('district_travel');
  });
});

describe('ADM-14 Data imports · failed file and file reading', () => {
  it('a file whose last import failed opens ADM-15 on that import', async () => {
    renderLive(<Imports />, {
      session: SESSIONS.admin,
      handler: req => (req.path === 'DataImports' && req.query.$filter === "file eq 'outlets'" ? page([failed]) : fallback(req)),
    });
    const row = await screen.findByTestId('file-outlets');
    await waitFor(() => expect(row).toHaveTextContent('Check failed'));
    fireEvent.click(row);
    expect(router.push).toHaveBeenCalledWith('/admin/adm-15-import-check-failed?id=imp-9');
    fireEvent.click(screen.getByTestId('file-vehicles'));
    expect(router.push).toHaveBeenCalledTimes(1); // a clean file has nothing to open
  });

  it('reads a picked file with a FileReader where Blob.text() is missing', async () => {
    const blob = new Blob(['outlet_id\nOUT1\n'], { type: 'text/csv' });
    Object.defineProperty(blob, 'text', { value: undefined });
    await expect(readText(blob)).resolves.toBe('outlet_id\nOUT1\n');
  });
});

describe('ADM-15 Import check failed', () => {
  it('shows the newest failed import’s rejected rows and checks', async () => {
    renderLive(<ImportFailed />, { session: SESSIONS.admin, handler: req => (req.path === 'DataImports' ? page([failed]) : fallback(req)) });
    expect(await screen.findByText('Import check failed')).toBeInTheDocument();
    expect(await screen.findByTestId('rejected-rows')).toHaveTextContent('OUT088');
    expect(rejectedCsv(failed as unknown as DataImport)).toContain('89,OUT088,parking_constraint,vans');
  });
});

describe('ADM-17 Planning agent guardrails', () => {
  it('shows the locked approval guardrail and what the agent reads, from the agent config', async () => {
    renderLive(<Guardrails />, { session: SESSIONS.admin, handler: req => (req.path.includes('AgentConfig') ? { value: CONFIG } : fallback(req)) });
    expect(await screen.findByText("It can never publish a plan without a dispatcher's approval")).toBeInTheDocument();
    expect(await screen.findByTestId('may-do')).toHaveTextContent('up to 3 redrafts');
    expect(screen.getByTestId('may-read')).toHaveTextContent('not read');
  });

  it('“See its last 30 proposals” opens the audit log on the planning agent’s entries', async () => {
    const view = renderLive(<Guardrails />, { session: SESSIONS.admin, handler: req => (req.path.includes('AgentConfig') ? { value: CONFIG } : fallback(req)) });
    fireEvent.click(screen.getByText('See its last 30 proposals'));
    expect(window.sessionStorage.getItem('lodestar.audit.area')).toBe('agent');
    view.unmount();
    const log = renderLive(<AuditLog />, { session: SESSIONS.admin, handler: fallback });
    await waitFor(() => expect(log.calls.some(c => c.path === 'AuditEntries' && c.query.$filter === "entitySet in ('AgentRuns')" && c.query.$top === '30')).toBe(true));
    expect(screen.getByText('Planning agent', { selector: '.d-filter' })).toHaveClass('is-on');
    expect(window.sessionStorage.getItem('lodestar.audit.area')).toBeNull();
  });
});
