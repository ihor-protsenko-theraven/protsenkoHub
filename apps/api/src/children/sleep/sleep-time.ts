import { HOUSEHOLD } from '../../config/household.config';
import {
  ASSUMED_AGE_WEEKS,
  CLOCK_SKEW_MS,
  MAX_SLEEP_MIN,
  STALE_SLEEP_MIN,
} from './sleep.config';
import type { ZonedParts } from './sleep-time.model';

export { ASSUMED_AGE_WEEKS, CLOCK_SKEW_MS, MAX_SLEEP_MIN, STALE_SLEEP_MIN };

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export type { ZonedParts } from './sleep-time.model';

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat(HOUSEHOLD.partLocale, {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  let hour = read('hour');
  if (hour === 24) hour = 0;
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
    minute: read('minute'),
    second: read('second'),
  };
}

export function zonedDateKey(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Wall-clock time in `timeZone` as a UTC instant. */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const parts = zonedParts(new Date(utcGuess), timeZone);
  const partsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return new Date(utcGuess + (utcGuess - partsUtc));
}

export function startOfLocalDay(date: Date, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  return zonedWallTimeToUtc(parts.year, parts.month, parts.day, 0, 0, timeZone);
}

export function nextLocalMidnight(date: Date, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  const next = addCalendarDays(parts.year, parts.month, parts.day, 1);
  return zonedWallTimeToUtc(next.year, next.month, next.day, 0, 0, timeZone);
}

export function formatClock(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins} хв`;
  if (mins === 0) return `${hours} год`;
  return `${hours} год ${mins} хв`;
}

export function overlapMinutes(
  start: Date,
  end: Date,
  windowStart: Date,
  windowEnd: Date,
): number {
  const from = Math.max(start.getTime(), windowStart.getTime());
  const to = Math.min(end.getTime(), windowEnd.getTime());
  return Math.max(0, to - from) / 60000;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function suggestedKind(date: Date, timeZone: string): 'NAP' | 'NIGHT' {
  const hour = zonedParts(date, timeZone).hour;
  return hour >= 18 || hour < 6 ? 'NIGHT' : 'NAP';
}

export function calendarAgeDays(
  birthDate: string,
  now: Date,
  timeZone: string,
): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const today = zonedParts(now, timeZone);
  const birthUtc = Date.UTC(year, month - 1, day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((todayUtc - birthUtc) / 86400000);
}

export function ageLabelFromDays(days: number): string {
  const months = Math.floor(days / 30.436875);
  const extraDays = Math.max(0, Math.round(days - months * 30.436875));
  if (months <= 0) return `${days} дн.`;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths === 0 ? `${years} р.` : `${years} р. ${remMonths} міс.`;
  }
  if (extraDays === 0) return `${months} міс.`;
  return `${months} міс. ${extraDays} дн.`;
}
