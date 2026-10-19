import { elapsedMs, formatClockDuration, asleepMs } from './sleep-clock';

describe('sleep clock', () => {
  it('continues from the server start after a reload', () => {
    const startedAt = '2026-10-19T08:00:00.000Z';
    const firstNow = Date.parse('2026-10-19T08:40:00.000Z');
    const clockOffset = 2000;
    const beforeReload = elapsedMs(startedAt, firstNow, clockOffset);
    const afterReload = elapsedMs(startedAt, firstNow + 30 * 60 * 1000, clockOffset);

    expect(beforeReload).toBe(40 * 60 * 1000 + clockOffset);
    expect(formatClockDuration(beforeReload)).toBe('0:40:02');
    expect(afterReload - beforeReload).toBe(30 * 60 * 1000);
    expect(formatClockDuration(afterReload)).toBe('1:10:02');
  });

  it('freezes sleep time while a pause is open and keeps counting after resume', () => {
    const startedAt = '2026-10-19T08:00:00.000Z';
    const pauseStart = '2026-10-19T08:20:00.000Z';
    const now = Date.parse('2026-10-19T08:35:00.000Z');
    const frozen = asleepMs(startedAt, null, [{ startedAt: pauseStart, endedAt: null }], now, 0);
    const resumed = asleepMs(
      startedAt,
      null,
      [{ startedAt: pauseStart, endedAt: '2026-10-19T08:25:00.000Z' }],
      now,
      0,
    );

    expect(frozen).toBe(20 * 60 * 1000);
    expect(resumed).toBe(30 * 60 * 1000);
  });
});
