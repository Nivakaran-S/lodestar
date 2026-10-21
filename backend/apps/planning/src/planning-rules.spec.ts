import { DeferralScoringService } from './deferral-scoring.service';
import { arrivedLate, DEFERRAL_WEIGHTS, latenessAuc, measureModels, planningRules, PROTECTED_SCORE, serviceStart, serviceTimeMae, StopOutcome } from './planning-rules';

const run = new Date('2026-04-07T00:00:00Z');
const at = (hhmm: string) => new Date(`2026-04-07T${hhmm}:00+05:30`);
const stop = (o: Partial<StopOutcome>): StopOutcome => ({
  serviceMinPredicted: null, lateRiskPct: null, arrivalActual: null, leaveActual: null, runDate: run, windowClose: '08:00', ...o,
});

describe('planning rules (Plans/Lodestar.PlanningRules)', () => {
  it('serves the weights and thresholds the scoring service uses', () => {
    const r = planningRules();
    expect(r.deferral.weights).toBe(DEFERRAL_WEIGHTS);
    expect(r.cutoff).toBe('16:00');
    const s = new DeferralScoringService();
    const score = s.computeScore({ deferredYesterday: true, daysSince: 2, tempClass: 'CHILLED' as any, brand: 'FRESH' as any, windowOpen: '05:30', nextRunWithin24h: true });
    const w = r.deferral.weights;
    expect(score).toBe(w.deferredYesterday + 2 * w.perDaySince + w.chilled + w.freshBeforeOpening + w.nextRunWithin24h);
    expect(s.isProtected(r.deferral.protectedScore)).toBe(true);
    expect(s.isProtected(PROTECTED_SCORE - 1)).toBe(false);
    expect(s.isDeferralCandidate(r.deferral.candidateBelow - 1)).toBe(true);
    expect(r.alertDefaults.lateRisk.threshold).toBe(r.lateRisk.alertPct);
  });

  it('measures service-time MAE only from stops with a prediction and an outcome', () => {
    expect(serviceTimeMae([stop({ serviceMinPredicted: 10 })])).toMatchObject({ value: null, n: 0 });
    const two = [
      stop({ serviceMinPredicted: 10, arrivalActual: at('06:00'), leaveActual: at('06:13') }),
      stop({ serviceMinPredicted: 20, arrivalActual: at('07:00'), leaveActual: at('07:19') }),
    ];
    // too few to judge: no figure, and says how many there are
    expect(serviceTimeMae(two)).toMatchObject({ value: null, n: 2, reason: expect.stringMatching(/2 stops .* scored from 10/) });
    expect(serviceTimeMae(Array.from({ length: 5 }, () => two).flat())).toEqual({ value: 2, n: 10 });
  });

  it('measures service time from the window opening when the van arrived early (the wait is not service)', () => {
    // arrived 05:00, window opens 05:30, left 05:45: 15 min of service, not 45
    const early = stop({ serviceMinPredicted: 15, arrivalActual: at('05:00'), leaveActual: at('05:45'), windowOpen: '05:30' });
    expect(serviceStart(early).getTime()).toBe(at('05:30').getTime());
    expect(serviceTimeMae(Array.from({ length: 10 }, () => early))).toEqual({ value: 0, n: 10 });
    // arriving after the window opened: from the arrival
    const late = stop({ serviceMinPredicted: 15, arrivalActual: at('06:00'), leaveActual: at('06:20'), windowOpen: '05:30' });
    expect(serviceTimeMae(Array.from({ length: 10 }, () => late))).toEqual({ value: 5, n: 10 });
  });

  it('measures lateness AUC against arrival after the window close, or says why not', () => {
    expect(arrivedLate(stop({ arrivalActual: at('08:01') }))).toBe(true);
    expect(arrivedLate(stop({ arrivalActual: at('07:59') }))).toBe(false);
    expect(latenessAuc([stop({ lateRiskPct: 40, arrivalActual: at('07:00') })])).toMatchObject({ value: null, n: 1, reason: expect.stringMatching(/0 late, 1 on time/) });
    const three = [
      stop({ lateRiskPct: 80, arrivalActual: at('08:30') }),
      stop({ lateRiskPct: 20, arrivalActual: at('07:00') }),
      stop({ lateRiskPct: 50, arrivalActual: at('07:10') }),
    ];
    // one late arrival is not enough to score a ranking
    expect(latenessAuc(three)).toMatchObject({ value: null, n: 3, reason: expect.stringMatching(/1 late, 2 on time/) });
    expect(latenessAuc([...three, ...three, ...three])).toEqual({ value: 1, n: 9 });
  });

  it('scopes the measured stops to the caller’s depots and never invents a demand score', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const out = await measureModels({ tripStop: { findMany } } as any, ['KANDY']);
    expect(findMany.mock.calls[0][0].where).toEqual({ arrivalActual: { not: null }, trip: { is: { depot: { in: ['KANDY'] } } } });
    expect(out.demand.measured.value).toBeNull();
    expect(out.serviceTime.target.value).toBe(4);
    await measureModels({ tripStop: { findMany } } as any, null);
    expect(findMany.mock.calls[1][0].where).toEqual({ arrivalActual: { not: null } });
  });
});
