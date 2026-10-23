import { SLEEP_REMINDER } from './sleep-reminder.config';
import type { ReminderCandidate, ReminderMoment } from './sleep-reminder.model';

/** A reminder is eligible only near its current due minute. */
export function dueSleepReminders(
  overview: ReminderCandidate,
  now: Date,
): ReminderMoment[] {
  if (overview.active || !overview.nextSleepAt || !overview.awakeSince)
    return [];
  const nextSleepAt = new Date(overview.nextSleepAt);
  const awakeSince = new Date(overview.awakeSince);
  if (
    !Number.isFinite(nextSleepAt.getTime()) ||
    !Number.isFinite(awakeSince.getTime())
  )
    return [];
  return SLEEP_REMINDER.leadMinutes.flatMap((leadMinutes) => {
    const dueAt = nextSleepAt.getTime() - leadMinutes * SLEEP_REMINDER.minuteMs;
    const lateness = now.getTime() - dueAt;
    return lateness >= 0 && lateness < SLEEP_REMINDER.sendWindowMs
      ? [{ leadMinutes, nextSleepAt, awakeSince }]
      : [];
  });
}
