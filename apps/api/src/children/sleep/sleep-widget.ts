import { SLEEP_WIDGET } from './sleep-widget.config';
import type {
  SleepWidgetSnapshot,
  SleepWidgetSource,
} from './sleep-widget.model';

export function toSleepWidgetSnapshot(
  source: SleepWidgetSource,
): SleepWidgetSnapshot {
  const base = {
    schemaVersion: SLEEP_WIDGET.schemaVersion,
    serverNow: source.serverNow,
    timeZone: source.timeZone,
    childName: source.profile.babyName,
  };
  const active = source.active;
  if (!active) {
    return {
      ...base,
      state: 'idle',
      nextSleepAt: source.nextSleepAt,
      active: null,
    };
  }

  const pause = active.pauses.find((item) => item.endedAt === null);
  return {
    ...base,
    state: source.activeStale ? 'stale' : pause ? 'paused' : 'sleeping',
    nextSleepAt: null,
    active: {
      sessionId: active.id,
      revision: active.revision,
      kind: active.kind,
      startedAt: active.startedAt,
      pauseStartedAt: pause?.startedAt ?? null,
      asleepMs: asleepDurationMs(
        active.startedAt,
        active.pauses,
        source.serverNow,
      ),
    },
  };
}

function asleepDurationMs(
  startedAt: string,
  pauses: NonNullable<SleepWidgetSource['active']>['pauses'],
  serverNow: string,
): number {
  const start = Date.parse(startedAt);
  const now = Date.parse(serverNow);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return 0;
  let pausedMs = 0;
  for (const pause of pauses) {
    const from = Math.max(start, Date.parse(pause.startedAt));
    const to = Math.min(now, pause.endedAt ? Date.parse(pause.endedAt) : now);
    if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
      pausedMs += to - from;
    }
  }
  return Math.max(0, now - start - pausedMs);
}
