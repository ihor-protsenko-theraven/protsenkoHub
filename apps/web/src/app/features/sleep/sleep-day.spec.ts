import { isCurrentDaySession } from './sleep-day';

describe('current sleep day', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');
  const timeZone = 'Europe/Kyiv';

  it('keeps a session that ended today with the current day', () => {
    expect(isCurrentDaySession({
      startedAt: '2026-10-20T20:00:00.000Z',
      endedAt: '2026-10-21T04:00:00.000Z',
    }, timeZone, now)).toBe(true);
  });

  it('keeps an open session on the current day', () => {
    expect(isCurrentDaySession({
      startedAt: '2026-10-20T20:00:00.000Z',
      endedAt: null,
    }, timeZone, now)).toBe(true);
  });

  it('sends an older finished session to history', () => {
    expect(isCurrentDaySession({
      startedAt: '2026-10-19T08:00:00.000Z',
      endedAt: '2026-10-19T09:00:00.000Z',
    }, timeZone, now)).toBe(false);
  });
});
