import {APP_LOCALE} from '../../core/configs/locale.config';

export type SleepTimeFormat = 'clock' | 'dateTime';

const formatters = new Map<string, Intl.DateTimeFormat>();

export function formatSleepTime(
  value: string | Date | null | undefined,
  timeZone: string,
  format: SleepTimeFormat = 'clock',
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }

  if (format === 'dateTime') return formatter.format(date);
  const parts = formatter.formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  return `${hour}:${minute}`;
}
