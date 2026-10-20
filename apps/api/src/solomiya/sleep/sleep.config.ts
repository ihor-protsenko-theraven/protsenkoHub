export const SLEEP_TRACKER = {
  assumedAgeWeeks: 17,
  maxSleepMin: 16 * 60,
  staleSleepMin: 14 * 60,
  clockSkewMs: 2 * 60 * 1000,
  historyDays: 21,
  minSessionMs: 60_000,
  minuteMs: 60_000,
  dayMs: 24 * 60 * 60 * 1000,
} as const;

export const ASSUMED_AGE_WEEKS = SLEEP_TRACKER.assumedAgeWeeks;
export const MAX_SLEEP_MIN = SLEEP_TRACKER.maxSleepMin;
export const STALE_SLEEP_MIN = SLEEP_TRACKER.staleSleepMin;
export const CLOCK_SKEW_MS = SLEEP_TRACKER.clockSkewMs;
