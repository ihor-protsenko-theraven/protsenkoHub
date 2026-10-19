export type SleepKind = 'NAP' | 'NIGHT';

export function sleepKindLabel(kind: SleepKind): string {
  switch (kind) {
    case 'NAP':
      return 'Денний сон';
    case 'NIGHT':
      return 'Ніч';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export interface SleepPause {
  id: string;
  startedAt: string;
  endedAt: string | null;
}

export interface SleepSession {
  id: string;
  kind: SleepKind;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  startedByName: string | null;
  endedByName: string | null;
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
  ageWeeks: number;
  ageLabel: string;
  assumedAge: boolean;
  napTarget: number | null;
}

export interface SleepOverview {
  serverNow: string;
  timeZone: string;
  profile: SleepProfile;
  active: SleepSession | null;
  sessions: SleepSession[];
  headline: string;
  detail: string;
  nextSleepAt: string | null;
  prepareAt: string | null;
  expectedWakeAt: string | null;
  wakeWindowMin: number | null;
  lifeWeek: number;
  weekNote: string | null;
  napTarget: number;
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

export interface SleepPayload {
  kind: SleepKind;
  startedAt: string;
  endedAt?: string | null;
  notes?: string | null;
}
