import { Logger } from '@nestjs/common';
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

/** Next future reminder timestamp (after `now`) for scheduling wake-ups. */
export function nextSleepReminderAt(
  overview: ReminderCandidate,
  now: Date,
): Date | null {
  if (overview.active || !overview.nextSleepAt || !overview.awakeSince) {
    return null;
  }
  const nextSleepAt = new Date(overview.nextSleepAt);
  if (!Number.isFinite(nextSleepAt.getTime())) return null;
  const nowMs = now.getTime();
  let earliest: number | null = null;
  for (const leadMinutes of SLEEP_REMINDER.leadMinutes) {
    const dueAt = nextSleepAt.getTime() - leadMinutes * SLEEP_REMINDER.minuteMs;
    if (dueAt > nowMs && (earliest === null || dueAt < earliest)) {
      earliest = dueAt;
    }
  }
  return earliest === null ? null : new Date(earliest);
}

const schedulerLogger = new Logger('SleepReminderScheduler');

export async function notifySleepReminderScheduler(): Promise<void> {
  const origin = process.env.SLEEP_REMINDER_SCHEDULER_URL?.trim();
  const secret = process.env.CRON_SECRET?.trim();
  if (!origin || !secret) return;
  let endpoint: URL;
  try {
    endpoint = new URL('/schedule', origin);
  } catch {
    return;
  }
  if (endpoint.protocol !== 'https:') return;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dirty: true }),
      signal: AbortSignal.timeout(SLEEP_REMINDER.schedulerTimeoutMs),
    });
    if (!response.ok) schedulerLogger.warn(`Schedule update returned ${response.status}`);
  } catch {
    schedulerLogger.warn('Schedule update could not reach the reminder worker');
  }
}
