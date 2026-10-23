export interface ReminderCandidate {
  active: object | null;
  nextSleepAt: string | null;
  awakeSince: string | null;
}

export interface ReminderMoment {
  leadMinutes: 20 | 10 | 0;
  nextSleepAt: Date;
  awakeSince: Date;
}

export interface PushError {
  statusCode?: number;
}
