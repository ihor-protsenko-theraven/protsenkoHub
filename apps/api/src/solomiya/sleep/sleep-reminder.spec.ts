import { dueSleepReminders } from './sleep-reminder-time';
import { isAllowedPushEndpoint } from './sleep-reminder.service';

describe('sleep push reminder timing', () => {
  const nextSleepAt = '2026-10-20T12:00:00.000Z';
  const awakeSince = '2026-10-20T09:00:00.000Z';
  const overview = { active: null, nextSleepAt, awakeSince };

  it.each([
    ['11:40', 20],
    ['11:50', 10],
    ['12:00', 0],
  ])('selects the %s reminder once due', (clock, leadMinutes) => {
    const now = new Date(`2026-10-20T${clock}:00.000Z`);
    expect(
      dueSleepReminders(overview, now).map((item) => item.leadMinutes),
    ).toEqual([leadMinutes]);
  });

  it('does not send early, stale, or while sleep is active', () => {
    expect(
      dueSleepReminders(overview, new Date('2026-10-20T11:39:59.000Z')),
    ).toEqual([]);
    expect(
      dueSleepReminders(overview, new Date('2026-10-20T11:42:00.000Z')),
    ).toEqual([]);
    expect(
      dueSleepReminders(
        { ...overview, active: {} },
        new Date('2026-10-20T11:40:00.000Z'),
      ),
    ).toEqual([]);
    expect(
      dueSleepReminders(
        { ...overview, nextSleepAt: null },
        new Date('2026-10-20T11:40:00.000Z'),
      ),
    ).toEqual([]);
  });

  it('accepts only known public push service hosts', () => {
    expect(
      isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'),
    ).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/QABC')).toBe(true);
    expect(
      isAllowedPushEndpoint(
        'https://updates.push.services.mozilla.com/wpush/v2/abc',
      ),
    ).toBe(true);
    expect(isAllowedPushEndpoint('http://fcm.googleapis.com/abc')).toBe(false);
    expect(isAllowedPushEndpoint('https://localhost/abc')).toBe(false);
    expect(
      isAllowedPushEndpoint('https://fcm.googleapis.com.evil.test/abc'),
    ).toBe(false);
  });
});
