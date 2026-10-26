import type { SleepWidgetSource } from './sleep-widget.model';
import { toSleepWidgetSnapshot } from './sleep-widget';

const now = '2026-10-20T09:00:00.000Z';

function source(overrides: Partial<SleepWidgetSource> = {}): SleepWidgetSource {
  return {
    serverNow: now,
    timeZone: 'Europe/Kyiv',
    profile: { babyName: 'Олена' },
    active: null,
    activeStale: false,
    nextSleepAt: '2026-10-20T10:30:00.000Z',
    lastSleep: null,
    ...overrides,
  };
}

describe('sleep widget snapshot', () => {
  it('shows the next predicted sleep while idle without sending the overview history', () => {
    expect(toSleepWidgetSnapshot(source())).toEqual({
      schemaVersion: 1,
      serverNow: now,
      timeZone: 'Europe/Kyiv',
      childName: 'Олена',
      state: 'idle',
      nextSleepAt: '2026-10-20T10:30:00.000Z',
      lastSleep: null,
      active: null,
    });
    expect(
      toSleepWidgetSnapshot(source({ nextSleepAt: null })).nextSleepAt,
    ).toBeNull();
  });

  it('subtracts completed pauses from a running sleep and includes only timer data', () => {
    const snapshot = toSleepWidgetSnapshot(
      source({
        active: {
          id: 'sleep-1',
          revision: 3,
          kind: 'NAP',
          startedAt: '2026-10-20T08:00:00.000Z',
          pauses: [
            {
              startedAt: '2026-10-20T08:30:00.000Z',
              endedAt: '2026-10-20T08:45:00.000Z',
            },
          ],
        },
      }),
    );

    expect(snapshot.state).toBe('sleeping');
    expect(snapshot.nextSleepAt).toBeNull();
    expect(snapshot.active).toEqual({
      sessionId: 'sleep-1',
      revision: 3,
      kind: 'NAP',
      startedAt: '2026-10-20T08:00:00.000Z',
      pauseStartedAt: null,
      asleepMs: 45 * 60_000,
      pauseCount: 1,
    });
  });

  it('freezes the sleep duration at the start of an open pause', () => {
    const snapshot = toSleepWidgetSnapshot(
      source({
        active: {
          id: 'sleep-1',
          revision: 3,
          kind: 'NIGHT',
          startedAt: '2026-10-20T08:00:00.000Z',
          pauses: [{ startedAt: '2026-10-20T08:30:00.000Z', endedAt: null }],
        },
      }),
    );

    expect(snapshot.state).toBe('paused');
    expect(snapshot.active?.pauseStartedAt).toBe('2026-10-20T08:30:00.000Z');
    expect(snapshot.active?.asleepMs).toBe(30 * 60_000);
    expect(snapshot.active?.pauseCount).toBe(1);
  });

  it('reports the latest completed sleep and excludes its pauses', () => {
    const snapshot = toSleepWidgetSnapshot(
      source({
        lastSleep: {
          kind: 'NAP',
          startedAt: '2026-10-20T06:00:00.000Z',
          endedAt: '2026-10-20T08:00:00.000Z',
          pauses: [
            {
              startedAt: '2026-10-20T06:30:00.000Z',
              endedAt: '2026-10-20T06:45:00.000Z',
            },
          ],
        },
      }),
    );
    expect(snapshot.lastSleep).toEqual({
      kind: 'NAP',
      startedAt: '2026-10-20T06:00:00.000Z',
      endedAt: '2026-10-20T08:00:00.000Z',
      asleepMs: 105 * 60_000,
    });
  });

  it('marks a long-running active tracker as stale without claiming the cache is old', () => {
    const snapshot = toSleepWidgetSnapshot(
      source({
        activeStale: true,
        active: {
          id: 'sleep-1',
          revision: 3,
          kind: 'NIGHT',
          startedAt: '2026-10-19T18:00:00.000Z',
          pauses: [],
        },
      }),
    );

    expect(snapshot.state).toBe('stale');
    expect(snapshot.active?.sessionId).toBe('sleep-1');
    expect(snapshot).not.toHaveProperty('lastFetchedAt');
  });
});
