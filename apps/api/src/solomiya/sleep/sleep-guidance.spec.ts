import { HOUSEHOLD } from '../../config/household.config';
import { buildSleepGuidance } from './sleep-guidance';
import type { GuidanceSession } from './sleep-guidance.model';
import {
  addCalendarDays,
  formatClock,
  zonedParts,
  zonedWallTimeToUtc,
} from './sleep-time';

const timeZone = HOUSEHOLD.defaultTimeZone;

function at(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  return zonedWallTimeToUtc(year, month, day, hour, minute, timeZone);
}

function guide(now: Date, sessions: GuidanceSession[]) {
  return buildSleepGuidance({
    now,
    timeZone,
    ageWeeks: 17,
    ageLabel: 'близько 4 місяців',
    assumedAge: true,
    sessions,
  });
}

describe('sleep clock', () => {
  it('round-trips a Kyiv wall time', () => {
    const date = at(2026, 10, 19, 7, 30);
    const parts = zonedParts(date, timeZone);
    expect(parts).toMatchObject({
      year: 2026,
      month: 10,
      day: 19,
      hour: 7,
      minute: 30,
    });
  });
});

describe('sleep guidance', () => {
  const balancedNight = (): GuidanceSession => ({
    id: 'night',
    kind: 'NIGHT',
    startedAt: at(2026, 10, 18, 16, 30),
    endedAt: at(2026, 10, 19, 7, 0),
  });

  it('uses the 4-month wake window when sleep is on target and history is thin', () => {
    const now = at(2026, 10, 19, 8, 0);
    const result = guide(now, [balancedNight()]);
    expect(result.basis).toBe('age');
    expect(result.wakeWindowMin).toBe(105);
    expect(result.headline).toContain('Ще рано');
    expect(result.headline).toContain('08:50');
    expect(
      result.nextSleepAt && formatClock(new Date(result.nextSleepAt), timeZone),
    ).toBe('08:50');
    expect(
      result.prepareAt && formatClock(new Date(result.prepareAt), timeZone),
    ).toBe('08:40');
    expect(result.schedule[0]?.clock.startsWith('08:50')).toBe(true);
    expect(result.schedule.at(-1)?.label).toBe('Ніч');
    expect(result.howItWorks).toHaveLength(3);
  });

  it('calls the wake window open when she has been awake long enough', () => {
    const result = guide(at(2026, 10, 19, 8, 45), [balancedNight()]);
    expect(result.headline).toContain('гарне вікно');
  });

  it('recommends putting her down once the window has passed', () => {
    const result = guide(at(2026, 10, 19, 9, 20), [balancedNight()]);
    expect(result.headline).toContain('вкласти зараз');
    expect(result.basis).toBe('age');
    expect(result.nextSleepAt).toBeNull();
    expect(result.prepareAt).toBeNull();
  });

  it('does not invent sleep debt from an incomplete day of logs', () => {
    const result = guide(at(2026, 10, 19, 7, 30), [
      {
        id: 'short-night',
        kind: 'NIGHT',
        startedAt: at(2026, 10, 19, 1, 0),
        endedAt: at(2026, 10, 19, 7, 0),
      },
    ]);
    expect(result.basis).toBe('age');
    expect(result.wakeWindowMin).toBe(105);
    expect(
      result.signals.find((signal) => signal.label === 'Борг сну')?.value,
    ).toBe('замало записів за добу');
  });

  it('shortens the window when a full logged day has too little sleep', () => {
    const result = guide(at(2026, 10, 19, 7, 30), [
      {
        id: 'previous',
        kind: 'NAP',
        startedAt: at(2026, 10, 18, 7, 0),
        endedAt: at(2026, 10, 18, 8, 0),
      },
      {
        id: 'short-night',
        kind: 'NIGHT',
        startedAt: at(2026, 10, 19, 1, 0),
        endedAt: at(2026, 10, 19, 7, 0),
      },
    ]);
    expect(result.basis).toBe('debt');
    expect(result.wakeWindowMin).toBe(80);
  });

  it('does not personalize from wake windows logged more than two weeks ago', () => {
    const sessions: GuidanceSession[] = [];
    for (let day = 1; day <= 8; day += 1) {
      sessions.push(
        {
          id: `old-night-${day}`,
          kind: 'NIGHT',
          startedAt: at(2026, 9, day, 19, 0),
          endedAt: at(2026, 9, day + 1, 7, 0),
        },
        {
          id: `old-nap-${day}`,
          kind: 'NAP',
          startedAt: at(2026, 9, day + 1, 9, 0),
          endedAt: at(2026, 9, day + 1, 10, 0),
        },
      );
    }
    sessions.push(balancedNight());
    const result = guide(at(2026, 10, 19, 7, 30), sessions);
    expect(result.wakeWindowMin).toBe(105);
    expect(result.basis).toBe('age');
  });

  it('keeps four and five month guidance below three hours', () => {
    for (const ageWeeks of [18, 22]) {
      const result = buildSleepGuidance({
        now: at(2026, 10, 19, 16, 0),
        timeZone,
        ageWeeks,
        ageLabel: `${ageWeeks} тижнів`,
        assumedAge: false,
        sessions: [
          {
            id: 'night',
            kind: 'NIGHT',
            startedAt: at(2026, 10, 18, 19, 30),
            endedAt: at(2026, 10, 19, 7, 0),
          },
          {
            id: 'nap',
            kind: 'NAP',
            startedAt: at(2026, 10, 19, 14, 0),
            endedAt: at(2026, 10, 19, 15, 0),
          },
        ],
      });
      expect(result.wakeWindowMin).toBeLessThanOrEqual(150);
    }
  });

  it('blends the age norm toward the median of her own mornings', () => {
    const sessions: GuidanceSession[] = [];
    for (let ago = 1; ago <= 7; ago += 1) {
      const morning = addCalendarDays(2026, 10, 19, -ago);
      const previous = addCalendarDays(
        morning.year,
        morning.month,
        morning.day,
        -1,
      );
      sessions.push(
        {
          id: `night-${ago}`,
          kind: 'NIGHT',
          startedAt: at(previous.year, previous.month, previous.day, 19, 30),
          endedAt: at(morning.year, morning.month, morning.day, 7, 0),
        },
        {
          id: `nap-a-${ago}`,
          kind: 'NAP',
          startedAt: at(morning.year, morning.month, morning.day, 8, 30),
          endedAt: at(morning.year, morning.month, morning.day, 9, 30),
        },
        {
          id: `nap-b-${ago}`,
          kind: 'NAP',
          startedAt: at(morning.year, morning.month, morning.day, 11, 45),
          endedAt: at(morning.year, morning.month, morning.day, 12, 45),
        },
        {
          id: `nap-c-${ago}`,
          kind: 'NAP',
          startedAt: at(morning.year, morning.month, morning.day, 15, 15),
          endedAt: at(morning.year, morning.month, morning.day, 16, 15),
        },
      );
    }
    const today = addCalendarDays(2026, 10, 19, -1);
    sessions.push({
      id: 'last-night',
      kind: 'NIGHT',
      startedAt: at(today.year, today.month, today.day, 19, 30),
      endedAt: at(2026, 10, 19, 7, 0),
    });
    const result = guide(at(2026, 10, 19, 7, 30), sessions);
    expect(result.basis).toBe('blended');
    expect(result.wakeWindowMin).toBe(95);
    expect(
      result.nextSleepAt && formatClock(new Date(result.nextSleepAt), timeZone),
    ).toBe('08:40');
  });

  it('describes the sleep already in progress instead of asking to start another', () => {
    const result = guide(at(2026, 10, 19, 9, 0), [
      balancedNight(),
      {
        id: 'nap',
        kind: 'NAP',
        startedAt: at(2026, 10, 19, 8, 30),
        endedAt: null,
      },
    ]);
    expect(result.basis).toBe('sleeping');
    expect(result.headline.toLowerCase()).toContain('спить');
    expect(result.headline).not.toContain('вкласти зараз');
    expect(result.nextSleepAt).toBeNull();
    expect(
      result.expectedWakeAt &&
        formatClock(new Date(result.expectedWakeAt), timeZone),
    ).toBe('09:30');
    expect(result.awakeSince).toBeNull();
  });

  it('flags an open session that was never stopped, without inventing an end time', () => {
    const startedAt = at(2026, 10, 18, 16, 0);
    const result = guide(at(2026, 10, 19, 8, 0), [
      { id: 'open', kind: 'NIGHT', startedAt, endedAt: null },
    ]);
    expect(result.activeStale).toBe(true);
    expect(result.basis).toBe('stale');
    expect(result.expectedWakeAt).toBeNull();
  });

  it('stays the same when the same records are read again', () => {
    const now = at(2026, 10, 19, 8, 0);
    const sessions = [balancedNight()];
    expect(JSON.stringify(guide(now, sessions))).toBe(
      JSON.stringify(guide(now, sessions)),
    );
  });

  it('ignores a missed-log gap instead of learning a long wake window', () => {
    const result = guide(at(2026, 10, 19, 16, 0), [
      balancedNight(),
      {
        id: 'late-only',
        kind: 'NAP',
        startedAt: at(2026, 10, 19, 15, 0),
        endedAt: at(2026, 10, 19, 15, 40),
      },
    ]);
    expect(result.basis).toBe('age');
    expect(result.wakeWindowMin).toBe(120);
  });

  it('keeps the fourth nap on a nap window while the target is still 4', () => {
    const result = guide(at(2026, 10, 19, 15, 0), [
      balancedNight(),
      {
        id: 'nap-1',
        kind: 'NAP',
        startedAt: at(2026, 10, 19, 8, 50),
        endedAt: at(2026, 10, 19, 9, 50),
      },
      {
        id: 'nap-2',
        kind: 'NAP',
        startedAt: at(2026, 10, 19, 11, 50),
        endedAt: at(2026, 10, 19, 12, 50),
      },
      {
        id: 'nap-3',
        kind: 'NAP',
        startedAt: at(2026, 10, 19, 14, 10),
        endedAt: at(2026, 10, 19, 14, 40),
      },
    ]);
    expect(result.napTarget).toBe(4);
    expect(result.wakeWindowMin).toBe(114);
    expect(result.wakeWindowMin).toBeLessThan(155);
    expect(result.basis).toBe('debt');
    expect(result.schedule[0]?.kind).toBe('NAP');
    expect(result.detail).toContain('коротший за 35 хвилин');
    expect(
      result.signals.find((signal) => signal.label === 'Звідки порада')?.value,
    ).toBe('ваші дні і короткий попередній сон');
  });

  it('freezes the expected wake while a pause is open', () => {
    const result = guide(at(2026, 10, 19, 9, 0), [
      balancedNight(),
      {
        id: 'nap',
        kind: 'NAP',
        startedAt: at(2026, 10, 19, 8, 30),
        endedAt: null,
        pauses: [{ startedAt: at(2026, 10, 19, 8, 40), endedAt: null }],
      },
    ]);
    expect(
      result.expectedWakeAt &&
        formatClock(new Date(result.expectedWakeAt), timeZone),
    ).toBe('09:50');
  });

  it('pulls bedtime toward her own recent nights inside 18:30–20:30', () => {
    const sessions: GuidanceSession[] = [];
    for (let ago = 1; ago <= 5; ago += 1) {
      const morning = addCalendarDays(2026, 10, 19, -ago);
      const previous = addCalendarDays(
        morning.year,
        morning.month,
        morning.day,
        -1,
      );
      sessions.push({
        id: `night-${ago}`,
        kind: 'NIGHT',
        startedAt: at(previous.year, previous.month, previous.day, 19, 30),
        endedAt: at(morning.year, morning.month, morning.day, 7, 0),
      });
    }
    const result = guide(at(2026, 10, 19, 7, 30), [
      ...sessions,
      {
        id: 'last-night',
        kind: 'NIGHT',
        startedAt: at(2026, 10, 18, 19, 30),
        endedAt: at(2026, 10, 19, 7, 0),
      },
    ]);
    expect(result.schedule.at(-1)?.clock).toMatch(/^19:|^20:/);
  });

  it('explains the age norm before any sleep is logged', () => {
    const result = guide(at(2026, 10, 19, 8, 0), []);
    expect(result.headline).toContain('немає записів');
    expect(result.scheduleNote).toContain('07:00');
    expect(result.basis).toBe('age');
  });
});
