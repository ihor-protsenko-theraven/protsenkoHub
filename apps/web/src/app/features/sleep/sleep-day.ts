const dayFormatters = new Map<string, Intl.DateTimeFormat>();

export function calendarDay(value: string | Date, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(date);
}

export function isCurrentDaySession(
  session: { startedAt: string; endedAt: string | null },
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (session.endedAt === null) return true;
  const today = calendarDay(now, timeZone);
  return calendarDay(session.startedAt, timeZone) === today || calendarDay(session.endedAt, timeZone) === today;
}
