export const SLEEP_TRACKER = {
  maxSleepMin: 16 * 60,
  staleSleepMin: 14 * 60,
  clockSkewMs: 2 * 60 * 1000,
  historyDays: 21,
  minSessionMs: 60_000,
  minuteMs: 60_000,
  dayMs: 24 * 60 * 60 * 1000,
  defaultBabyName: 'Дитина',
  legacyDefaultBabyName: 'Соломія',
  kindLabels: {
    nap: 'денний сон',
    night: 'нічний сон',
  },
} as const;

export const MAX_SLEEP_MIN = SLEEP_TRACKER.maxSleepMin;
export const STALE_SLEEP_MIN = SLEEP_TRACKER.staleSleepMin;
export const CLOCK_SKEW_MS = SLEEP_TRACKER.clockSkewMs;

export function normalizeBabyName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === SLEEP_TRACKER.legacyDefaultBabyName) {
    return SLEEP_TRACKER.defaultBabyName;
  }
  return trimmed;
}
