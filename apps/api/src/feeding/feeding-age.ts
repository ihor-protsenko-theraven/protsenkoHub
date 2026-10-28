import { HOUSEHOLD } from '../config/household.config';

export function completedAgeMonths(
  birthDate: Date,
  now = new Date(),
  timeZone = HOUSEHOLD.defaultTimeZone,
): number {
  const [year, month, day] = birthDate
    .toISOString()
    .slice(0, 10)
    .split('-')
    .map(Number);
  const parts = new Intl.DateTimeFormat(HOUSEHOLD.partLocale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  const months =
    (part('year') - year) * 12 +
    (part('month') - month) -
    (part('day') < day ? 1 : 0);
  return Number.isFinite(months) ? Math.max(0, months) : 0;
}
