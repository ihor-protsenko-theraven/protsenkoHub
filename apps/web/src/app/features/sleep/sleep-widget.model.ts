export type SleepWidgetState = 'idle' | 'sleeping' | 'paused' | 'stale';

export interface SleepWidgetSnapshot {
  schemaVersion: 1;
  serverNow: string;
  timeZone: string;
  childName: string;
  state: SleepWidgetState;
  nextSleepAt: string | null;
  active: {
    sessionId: string;
    revision: number;
    kind: 'NAP' | 'NIGHT';
    startedAt: string;
    pauseStartedAt: string | null;
    asleepMs: number;
  } | null;
}

export interface CachedSleepWidgetSnapshot extends SleepWidgetSnapshot {
  receivedAt: string;
}
