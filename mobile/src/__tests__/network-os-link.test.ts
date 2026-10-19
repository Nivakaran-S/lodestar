import { network, osConnected, reportReachable } from '@/offline/network';

describe('network: a failed API call vs the OS link', () => {
  it('a failed call marks the app offline but keeps the OS link, so the outbox still retries', () => {
    reportReachable(false);
    expect(network.get().online).toBe(false);
    expect(osConnected()).toBe(true);
    reportReachable(true);
    expect(network.get().online).toBe(true);
  });
});

describe('network: a failed call does not strand the app offline while the OS has a link', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    reportReachable(true);
    jest.useRealTimers();
  });

  it('tries again after 10 s, then backs off while the server keeps failing', () => {
    reportReachable(false);
    expect(network.get().online).toBe(false);
    jest.advanceTimersByTime(9_999);
    expect(network.get().online).toBe(false);
    jest.advanceTimersByTime(1);
    expect(network.get().online).toBe(true); // screens fetch again
    reportReachable(false); // still failing: the next try waits longer
    jest.advanceTimersByTime(10_000);
    expect(network.get().online).toBe(false);
    jest.advanceTimersByTime(10_000);
    expect(network.get().online).toBe(true);
  });

  it('a success resets the wait', () => {
    reportReachable(false);
    jest.advanceTimersByTime(10_000);
    reportReachable(true);
    reportReachable(false);
    jest.advanceTimersByTime(10_000);
    expect(network.get().online).toBe(true);
  });
});
