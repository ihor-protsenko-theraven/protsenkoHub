export type SleepKindName = 'NAP' | 'NIGHT';
export type GuidanceBasis = 'age' | 'blended' | 'debt' | 'sleeping' | 'stale';
export type AgeBand =
  | 'newborn'
  | 'twoMonths'
  | 'threeMonths'
  | 'fourMonths'
  | 'fiveMonths'
  | 'fiveToSix'
  | 'older';

export interface GuidancePause {
  startedAt: Date;
  endedAt: Date | null;
}

export interface GuidanceSession {
  id: string;
  kind: SleepKindName;
  startedAt: Date;
  endedAt: Date | null;
  pauses?: GuidancePause[];
}

export interface ClosedSession extends GuidanceSession {
  endedAt: Date;
}

export interface GuidanceInput {
  now: Date;
  timeZone: string;
  ageWeeks: number;
  ageLabel: string;
  assumedAge: boolean;
  napTarget?: number | null;
  sessions: GuidanceSession[];
}

export interface SleepSignal {
  label: string;
  value: string;
}

export interface ScheduleItem {
  label: string;
  kind: SleepKindName;
  startsAt: string;
  endsAt: string;
  clock: string;
}

export interface TodayBlock {
  id: string;
  kind: SleepKindName;
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
  hasFullDayHistory: boolean;
  weekAvgSleepMin: number | null;
  weekAvgNapCount: number | null;
  bedtimeClock: string | null;
  wakeClock: string | null;
  bedtimeSpreadMin: number | null;
  longestStretchMin: number;
}

export interface SleepGuidance {
  headline: string;
  detail: string;
  nextSleepAt: string | null;
  prepareAt: string | null;
  expectedWakeAt: string | null;
  wakeWindowMin: number | null;
  lifeWeek: number;
  weekNote: string | null;
  napTarget: number;
  basis: GuidanceBasis;
  signals: SleepSignal[];
  schedule: ScheduleItem[];
  scheduleNote: string | null;
  howItWorks: string[];
  disclaimer: string;
  suggestedKind: SleepKindName;
  activeStale: boolean;
  awakeSince: string | null;
  stats: SleepStats;
  todayBlocks: TodayBlock[];
  week: WeekDay[];
}

export interface SleepNorm {
  totalTargetMin: number;
  wakeWindowsMin: [number, number, number, number];
  maxWakeWindowMin: number;
  typicalNapMin: number;
  typicalNightMin: number;
  bedtimeStartMin: number;
  bedtimeEndMin: number;
}

export interface BedtimeAnchor {
  minute: number;
  count: number;
}

export interface AgeNormConfig {
  band: AgeBand;
  maxWeek: number;
  totalTargetMin: number;
  wakeWindowsMin: [number, number, number, number];
  maxWakeWindowMin: number;
  typicalNapMin: number;
  typicalNightMin: number;
}

export interface FussyWeekNote {
  from: number;
  to: number;
  text: string;
}
