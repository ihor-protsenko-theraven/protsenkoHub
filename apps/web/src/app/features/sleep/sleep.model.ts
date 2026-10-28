export type SleepKind = 'NAP' | 'NIGHT';
export type SleepClockMode = 'asleep' | 'paused' | 'awake';

export interface PauseSpan {
  startedAt: string;
  endedAt: string | null;
}

export interface SleepPause extends PauseSpan {
  id: string;
}

export interface SleepSession {
  id: string;
  kind: SleepKind;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  startedByName: string | null;
  endedByName: string | null;
  updatedByName: string | null;
  pauses: SleepPause[];
}

export interface SleepSignal {
  label: string;
  value: string;
}

export interface ScheduleItem {
  label: string;
  kind: SleepKind;
  startsAt: string;
  endsAt: string;
  clock: string;
}

export interface TodayBlock {
  id: string;
  kind: SleepKind;
  left: number;
  width: number;
  label: string;
}

export interface WeekDay {
  date: string;
  label: string;
  sleepMin: number;
  napCount: number;
  targetMin: number;
}

export interface SleepStats {
  todaySleepMin: number;
  todayNapCount: number;
  todayNapMin: number;
  todayNightMin: number;
  last24hSleepMin: number;
  targetSleepMin: number;
  sleepDebtMin: number;
  weekAvgSleepMin: number | null;
  weekAvgNapCount: number | null;
  bedtimeClock: string | null;
  wakeClock: string | null;
  bedtimeSpreadMin: number | null;
  longestStretchMin: number;
}

export interface SleepProfile {
  babyName: string;
  birthDate: string | null;
  ageWeeks: number | null;
  ageLabel: string | null;
  napTarget: number | null;
  updatedByName: string | null;
}

export interface SleepOverview {
  serverNow: string;
  timeZone: string;
  historyDays?: number;
  profile: SleepProfile;
  active: SleepSession | null;
  sessions: SleepSession[];
  headline: string;
  detail: string;
  nextSleepAt: string | null;
  prepareAt: string | null;
  expectedWakeAt: string | null;
  wakeWindowMin: number | null;
  lifeWeek: number | null;
  weekNote: string | null;
  napTarget: number | null;
  basis: string;
  signals: SleepSignal[];
  schedule: ScheduleItem[];
  scheduleNote: string | null;
  howItWorks: string[];
  disclaimer: string;
  suggestedKind: SleepKind;
  activeStale: boolean;
  awakeSince: string | null;
  stats: SleepStats;
  todayBlocks: TodayBlock[];
  week: WeekDay[];
}

export interface SleepForm {
  kind: SleepKind;
  startedAt: string;
  endedAt: string;
  notes: string;
}

export interface SavedPauseForm {
  startedAt: string;
  endedAt: string;
}

export interface SleepPayload {
  kind: SleepKind;
  startedAt: string;
  endedAt?: string | null;
  notes?: string | null;
}
