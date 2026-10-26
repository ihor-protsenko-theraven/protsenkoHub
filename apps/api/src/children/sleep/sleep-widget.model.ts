import type { SLEEP_WIDGET } from './sleep-widget.config';

export type SleepWidgetState = 'idle' | 'sleeping' | 'paused' | 'stale';

export interface SleepWidgetSnapshot {
  schemaVersion: typeof SLEEP_WIDGET.schemaVersion;
  serverNow: string;
  timeZone: string;
  childName: string;
  // This is the server's long-running active-sleep warning. A cached snapshot's
  // freshness is tracked separately by the mobile client when it fetches it.
  state: SleepWidgetState;
  nextSleepAt: string | null;
  lastSleep: {
    kind: 'NAP' | 'NIGHT';
    startedAt: string;
    endedAt: string;
    asleepMs: number;
  } | null;
  active: {
    sessionId: string;
    revision: number;
    kind: 'NAP' | 'NIGHT';
    startedAt: string;
    pauseStartedAt: string | null;
    asleepMs: number;
    pauseCount: number;
  } | null;
}

export interface SleepWidgetSource {
  serverNow: string;
  timeZone: string;
  profile: { babyName: string };
  active: {
    id: string;
    revision: number;
    kind: 'NAP' | 'NIGHT';
    startedAt: string;
    pauses: { startedAt: string; endedAt: string | null }[];
  } | null;
  activeStale: boolean;
  nextSleepAt: string | null;
  lastSleep: {
    kind: 'NAP' | 'NIGHT';
    startedAt: string;
    endedAt: string;
    pauses: { startedAt: string; endedAt: string | null }[];
  } | null;
}
