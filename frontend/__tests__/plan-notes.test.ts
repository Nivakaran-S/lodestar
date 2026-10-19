// planNote (a plan's notes as text) and runStamp (a plan screen's eyebrow): the agent stores its explanation as
// JSON, and a past run kept for review is not paired with today's clock.
import { runStamp } from '@/components/live/plan-data';
import { planNote } from '@/lib/format';
import { freezeDate, unfreeze } from './helpers/clock';

describe('planNote', () => {
  it('reads the text out of the agent’s JSON explanation', () => {
    expect(planNote('{"text":"Draft v1 for KANDY.\\n\\nWhat it did","did":["Read 31 open orders"],"checked":[]}')).toBe('Draft v1 for KANDY.\n\nWhat it did');
  });
  it('keeps plain notes and text that only looks like JSON', () => {
    expect(planNote('Bulk chilled order deferred')).toBe('Bulk chilled order deferred');
    expect(planNote('{not json')).toBe('{not json');
    expect(planNote('{"why":"x"}')).toBe('{"why":"x"}');
  });
  it('is null when there is nothing to show', () => {
    expect(planNote(null)).toBeNull();
    expect(planNote('  ')).toBeNull();
  });
});

describe('runStamp', () => {
  beforeEach(() => freezeDate('2026-04-06T08:00:00.000Z')); // Mon 6 Apr, 13:30 in Colombo
  afterEach(unfreeze);

  it('pairs today’s or a coming run with the clock', () => {
    expect(runStamp('2026-04-06')).toBe('Mon 6 Apr · 1:30 PM');
    expect(runStamp('2026-04-07', ', ')).toBe('Tue 7 Apr, 1:30 PM');
  });
  it('says a past run is a past day instead of pairing it with today’s clock', () => {
    expect(runStamp('2026-03-30')).toBe('Mon 30 Mar run, a past day');
  });
});
