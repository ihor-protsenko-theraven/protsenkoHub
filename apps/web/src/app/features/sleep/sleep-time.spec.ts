import {formatSleepTime} from './sleep-time';
import {SleepTimePipe} from './sleep-time.pipe';

describe('sleep time in the family time zone', () => {
  const instant = '2026-10-25T17:40:00.000Z';

  it('formats IANA zones independently of the device clock', () => {
    expect(formatSleepTime(instant, 'Europe/Kyiv')).toBe('19:40');
    expect(formatSleepTime(instant, 'Europe/Warsaw')).toBe('18:40');
    expect(formatSleepTime('2026-07-01T17:40:00.000Z', 'Europe/Kyiv')).toBe('20:40');
  });

  it('formats the history date and delegates from the template pipe', () => {
    expect(formatSleepTime(instant, 'Europe/Kyiv', 'dateTime')).toBe('25 жовт., 19:40');
    expect(new SleepTimePipe().transform(instant, 'Europe/Kyiv')).toBe('19:40');
  });
});
