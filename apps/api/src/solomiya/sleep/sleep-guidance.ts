import {
  addCalendarDays,
  formatClock,
  formatMinutes,
  median,
  nextLocalMidnight,
  overlapMinutes,
  pad,
  startOfLocalDay,
  STALE_SLEEP_MIN,
  suggestedKind,
  zonedDateKey,
  zonedParts,
  zonedWallTimeToUtc,
} from './sleep-time';

/**
 * Recommendations combine three public signals:
 * 1. Age norms for wake windows and total sleep (AAP: 12–16h at 4–12 months;
 *    4-month wake windows lengthen from about 1h 45m to 2h 35m).
 * 2. The baby's own recent median, blended with the norm so one hard day
 *    does not swing the plan. Little data keeps the norm in charge.
 * 3. A simplified two-process model (Borbély): homeostatic debt shortens the
 *    next window; bedtime stays inside a circadian anchor of 18:30–20:30.
 */

export type SleepKindName = 'NAP' | 'NIGHT';
export type GuidanceBasis = 'age' | 'blended' | 'debt' | 'sleeping' | 'stale';

export interface GuidanceSession {
  id: string;
  kind: SleepKindName;
  startedAt: Date;
  endedAt: Date | null;
  pauses?: { startedAt: Date; endedAt: Date | null }[];
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

interface SleepNorm {
  totalTargetMin: number;
  wakeWindowsMin: [number, number, number, number];
  typicalNapMin: number;
  typicalNightMin: number;
  bedtimeStartMin: number;
  bedtimeEndMin: number;
}

interface ClosedSession extends GuidanceSession {
  endedAt: Date;
}

const PRIOR_WEIGHT = 4;
const HOW_IT_WORKS = [
  'Після кожного сну план на решту дня рахується заново: наступний сон, денні сни, що лишились, і ніч. Поки своїх записів мало, береться норма віку.',
  'Час показуємо кроком у 10 хвилин. Окремо є час готуватися — заспокоїти Соломію до самого сну. Ніч лишається у вікні 18:30–20:30.',
  'Один зіпсований таймер не переписує графік: задовгий запис у розрахунок не входить, а пропущена відмітка не означає, що сон скасовано.',
];
const DISCLAIMER =
  'Це орієнтир за віком і вашими відмітками, не медична порада. Якщо сон різко змінився, зверніться до педіатра.';

type AgeBand =
  | 'newborn'
  | 'twoMonths'
  | 'threeMonths'
  | 'fourMonths'
  | 'fiveToSix'
  | 'older';

export function buildSleepGuidance(input: GuidanceInput): SleepGuidance {
  const norms = normsForWeeks(input.ageWeeks);
  const napTarget = normalizeNapTarget(input.napTarget, input.ageWeeks);
  const rhythm = {
    lifeWeek: input.ageWeeks,
    weekNote: weekNoteFor(input.ageWeeks),
    napTarget,
  };
  const ordered = [...input.sessions].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  const active =
    [...ordered].reverse().find((session) => session.endedAt === null) ??
    null;
  const closed = ordered.filter(
    (session): session is ClosedSession => session.endedAt !== null,
  );
  const stats = computeStats(ordered, input.now, input.timeZone, norms);
  const todayBlocks = computeBlocks(ordered, input.now, input.timeZone);
  const week = computeWeek(
    ordered,
    input.now,
    input.timeZone,
    norms.totalTargetMin,
  );
  const wakeBySlot = wakeSamples(ordered, input.timeZone);
  const durationBySlot = durationSamples(ordered, input.timeZone);
  const suggested = suggestedKind(input.now, input.timeZone);
  const base = {
    howItWorks: HOW_IT_WORKS,
    disclaimer: DISCLAIMER,
    suggestedKind: suggested,
    stats,
    todayBlocks,
    week,
  };

  if (active) {
    const minutes = (input.now.getTime() - active.startedAt.getTime()) / 60000;
    if (minutes >= STALE_SLEEP_MIN) {
      return {
        ...base,
        headline: 'Сон триває вже дуже довго',
        detail:
          'Запис не завершено понад 14 годин. Якщо Соломія вже прокинулась, вкажіть фактичний час пробудження. Початок сну від цього не зітреться.',
        ...rhythm,
        nextSleepAt: null,
        prepareAt: null,
        expectedWakeAt: null,
        wakeWindowMin: null,
        basis: 'stale',
        signals: buildSignals(input, stats, null, 'вік і незавершений запис'),
        schedule: [],
        scheduleNote: null,
        activeStale: true,
        awakeSince: null,
      };
    }
    const slot = slotOf(active, ordered, input.timeZone);
    const typical = blend(
      active.kind === 'NIGHT' ? norms.typicalNightMin : norms.typicalNapMin,
      durationBySlot.get(slot) ?? [],
    );
    const expected = roundLocalTo10(
      new Date(active.startedAt.getTime() + typical.value * 60000),
      input.timeZone,
    );
    const label = active.kind === 'NIGHT' ? 'нічний сон' : 'денний сон';
    const windows = adjustedWindows(norms, wakeBySlot, 0);
    return {
      ...base,
      headline: `Соломія спить. Цей ${label} зазвичай триває ${formatMinutes(typical.value)}.`,
      detail: `Орієнтовне пробудження близько ${formatClock(expected, input.timeZone)}. Якщо спить спокійно довше за оцінку, будити заради графіка не потрібно.`,
      ...rhythm,
      nextSleepAt: null,
      prepareAt: null,
      expectedWakeAt: expected.toISOString(),
      wakeWindowMin: null,
      basis: 'sleeping',
      signals: buildSignals(
        input,
        stats,
        null,
        typical.personalized
          ? 'тривалість за вашими записами і нормою віку'
          : 'типова тривалість для цього віку',
      ),
      schedule: buildSchedule({
        now: input.now,
        timeZone: input.timeZone,
        norms,
        windows,
        cursor: expected.getTime() > input.now.getTime() ? expected : input.now,
        slot: Math.min(slot + 1, 3),
        napMin: norms.typicalNapMin,
        nightMin: norms.typicalNightMin,
        napTarget,
        ageWeeks: input.ageWeeks,
        example: false,
      }),
      scheduleNote: 'План на час після пробудження.',
      activeStale: false,
      awakeSince: null,
    };
  }

  const awakeSince = latestEnd(closed);
  const slot = nextSlot(input.now, ordered, input.timeZone);
  const debtMin = norms.totalTargetMin - stats.last24hSleepMin;
  const debtAdjust =
    ordered.length === 0
      ? 0
      : debtMin > 30
        ? -Math.min(25, Math.round(debtMin / 8))
        : debtMin < -45
          ? Math.min(15, Math.round(-debtMin / 12))
          : 0;
  const penalty = shortNapPenalty(closed, input.now);
  const blended = blend(
    windowAt(norms, slot),
    wakeBySlot.get(slot) ?? [],
  );
  const windowMin = clamp(blended.value + debtAdjust - penalty, 45, 240);
  const windows = adjustedWindows(norms, wakeBySlot, debtAdjust);
  windows[slot] = windowMin;
  const basis: GuidanceBasis =
    penalty > 0 || Math.abs(debtAdjust) >= 10
      ? 'debt'
      : blended.personalized
        ? 'blended'
        : 'age';
  const source = sourceText(blended.personalized, basis, input.assumedAge);
  const detail = detailText(windowMin, source, debtAdjust, penalty, debtMin);

  if (!awakeSince) {
    const morning = zonedWallTimeToUtc(
      zonedParts(input.now, input.timeZone).year,
      zonedParts(input.now, input.timeZone).month,
      zonedParts(input.now, input.timeZone).day,
      7,
      0,
      input.timeZone,
    );
    return {
      ...base,
      headline: `Поки немає записів. Для віку «${input.ageLabel}» перше вікно неспання близько ${formatMinutes(windowAt(norms, 0))}.`,
      detail:
        'Натисніть «Заснула», коли Соломія засне. Час одразу пишеться в сімейну базу, тож перезавантаження не скидає таймер. За кілька днів план підлаштується під неї.',
      ...rhythm,
      nextSleepAt: null,
      prepareAt: null,
      expectedWakeAt: null,
      wakeWindowMin: windowAt(norms, 0),
      basis: 'age',
      signals: buildSignals(input, stats, windowAt(norms, 0), source),
      schedule: buildSchedule({
        now: input.now,
        timeZone: input.timeZone,
        norms,
        windows: norms.wakeWindowsMin.map((value) => value),
        cursor: morning,
        slot: 0,
        napMin: norms.typicalNapMin,
        nightMin: norms.typicalNightMin,
        napTarget,
        ageWeeks: input.ageWeeks,
        example: true,
      }),
      scheduleNote:
        'Приклад дня, якщо підйом о 07:00. Після першого запису план піде від фактичного пробудження.',
      activeStale: false,
      awakeSince: null,
    };
  }

  const awakeMin = (input.now.getTime() - awakeSince.getTime()) / 60000;
  const nextAt = roundLocalTo10(
    new Date(awakeSince.getTime() + windowMin * 60000),
    input.timeZone,
  );
  const prepareAt = settleTime(nextAt, input.ageWeeks, input.timeZone);
  const clock = formatClock(nextAt, input.timeZone);
  let headline: string;
  if (awakeMin > 360) {
    headline = `Останнє пробудження було о ${formatClock(awakeSince, input.timeZone)}, вже ${formatMinutes(awakeMin)}. Якщо Соломія весь цей час не спала, краще вкласти зараз.`;
  } else if (awakeMin < windowMin - 15) {
    headline = `Ще рано. Наступне вкладання близько ${clock} (через ${formatMinutes(windowMin - awakeMin)}).`;
  } else if (awakeMin <= windowMin + 20) {
    headline = 'Зараз гарне вікно, щоб вкласти Соломію.';
  } else {
    headline = 'Вікно сну вже минуло — краще вкласти зараз, щоб не перевтомилась.';
  }

  return {
    ...base,
    ...rhythm,
    headline,
    detail,
    nextSleepAt: nextAt.toISOString(),
    prepareAt: prepareAt.toISOString(),
    expectedWakeAt: null,
    wakeWindowMin: windowMin,
    basis,
    signals: buildSignals(input, stats, windowMin, source),
    schedule: buildSchedule({
      now: input.now,
      timeZone: input.timeZone,
      norms,
      windows,
      cursor: awakeSince,
      slot,
      napMin: blend(norms.typicalNapMin, durationBySlot.get(0) ?? []).value,
      nightMin: norms.typicalNightMin,
      napTarget,
      ageWeeks: input.ageWeeks,
      example: false,
    }),
    scheduleNote: null,
    activeStale: false,
    awakeSince: awakeSince.toISOString(),
  };
}

function detailText(
  windowMin: number,
  source: string,
  debtAdjust: number,
  penalty: number,
  debtMin: number,
): string {
  let text = `Вікно неспання зараз ${formatMinutes(windowMin)} (${source}).`;
  if (debtAdjust <= -10) {
    text += ' За добу сну менше за ціль, тож наступне вкладання трохи раніше.';
  } else if (debtAdjust >= 10) {
    text += ' Сну за добу вже достатньо, тож поспішати з наступним сном не варто.';
  } else if (Math.abs(debtMin) <= 45 && penalty === 0) {
    text += ' Сон за останні 24 години близький до норми цього віку.';
  }
  if (penalty > 0) {
    text += ' Два останні сни були коротші за 40 хвилин, тому вікно скорочене.';
  }
  return text;
}

function sourceText(
  personalized: boolean,
  basis: GuidanceBasis,
  assumedAge: boolean,
): string {
  if (basis === 'debt' && personalized) {
    return 'ваші дні, норма віку і борг сну';
  }
  if (basis === 'debt') return 'норма віку з поправкою на борг сну';
  if (personalized) return 'норма віку, підлаштована під ваші записи';
  if (assumedAge) return 'норма для 4 місяців, поки не вказано дату народження';
  return 'вікова норма';
}

function buildSignals(
  input: GuidanceInput,
  stats: SleepStats,
  windowMin: number | null,
  source: string,
): SleepSignal[] {
  const debt =
    stats.sleepDebtMin > 20
      ? `${formatMinutes(stats.sleepDebtMin)} менше за ціль`
      : stats.sleepDebtMin < -20
        ? `${formatMinutes(Math.abs(stats.sleepDebtMin))} більше за ціль`
        : 'близько норми';
  const signals: SleepSignal[] = [
    {
      label: 'Вік',
      value: input.assumedAge ? `${input.ageLabel} (орієнтир)` : input.ageLabel,
    },
    {
      label: 'Сон за 24 год',
      value: `${formatMinutes(stats.last24hSleepMin)} із ${formatMinutes(stats.targetSleepMin)}`,
    },
    { label: 'Борг сну', value: debt },
  ];
  if (windowMin !== null) {
    signals.push({ label: 'Вікно неспання', value: formatMinutes(windowMin) });
  }
  signals.push({ label: 'Звідки порада', value: source });
  return signals;
}

function adjustedWindows(
  norms: SleepNorm,
  samples: Map<number, number[]>,
  debtAdjust: number,
): number[] {
  return [0, 1, 2, 3].map((slot) =>
    clamp(
      blend(windowAt(norms, slot), samples.get(slot) ?? []).value + debtAdjust,
      45,
      240,
    ),
  );
}

function buildSchedule(options: {
  now: Date;
  timeZone: string;
  norms: SleepNorm;
  windows: number[];
  cursor: Date;
  slot: number;
  napMin: number;
  nightMin: number;
  napTarget: number;
  ageWeeks: number;
  example: boolean;
}): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const minNap = options.ageWeeks >= 16 ? 30 : 20;
  let cursor = options.cursor;
  let slot = options.slot;
  while (slot < options.napTarget && slot < 4 && items.length < 4) {
    const windowMin =
      options.windows[Math.min(slot, 2)] ?? windowAt(options.norms, Math.min(slot, 2));
    const length = slot >= 3 ? Math.min(options.napMin, 40) : options.napMin;
    if (length < minNap) break;
    const start = roundLocalTo10(
      new Date(cursor.getTime() + windowMin * 60000),
      options.timeZone,
    );
    let end = roundLocalTo10(
      new Date(start.getTime() + length * 60000),
      options.timeZone,
    );
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + minNap * 60000);
    }
    const startMin = minutesOf(start, options.timeZone);
    const endMin = minutesOf(end, options.timeZone);
    if (startMin >= 17 * 60 + 15 || endMin >= 18 * 60) break;
    cursor = end;
    const currentSlot = slot;
    slot += 1;
    if (!options.example && end.getTime() < options.now.getTime()) continue;
    items.push(item(`Сон ${currentSlot + 1}`, 'NAP', start, end, options.timeZone));
  }
  const bed = roundLocalTo10(
    placeBedtime(
      cursor,
      options.windows[3] ?? windowAt(options.norms, 3),
      options.norms,
      options.timeZone,
    ),
    options.timeZone,
  );
  if (options.example || bed.getTime() > options.now.getTime() - 30 * 60000) {
    items.push(
      item(
        'Ніч',
        'NIGHT',
        bed,
        new Date(bed.getTime() + options.nightMin * 60000),
        options.timeZone,
      ),
    );
  }
  return items;
}

function item(
  label: string,
  kind: SleepKindName,
  start: Date,
  end: Date,
  timeZone: string,
): ScheduleItem {
  return {
    label,
    kind,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    clock: `${formatClock(start, timeZone)}–${formatClock(end, timeZone)}`,
  };
}

function placeBedtime(
  cursor: Date,
  windowMin: number,
  norms: SleepNorm,
  timeZone: string,
): Date {
  const proposed = new Date(cursor.getTime() + windowMin * 60000);
  const parts = zonedParts(proposed, timeZone);
  let mins = parts.hour * 60 + parts.minute;
  if (mins < 12 * 60) mins += 24 * 60;
  let target = mins;
  if (mins < norms.bedtimeStartMin) target = norms.bedtimeStartMin;
  else if (mins > norms.bedtimeEndMin) target = norms.bedtimeEndMin;
  const dayOffset = target >= 24 * 60 ? 1 : 0;
  const clock = target % (24 * 60);
  const day = addCalendarDays(parts.year, parts.month, parts.day, dayOffset);
  let bed = zonedWallTimeToUtc(
    day.year,
    day.month,
    day.day,
    Math.floor(clock / 60),
    clock % 60,
    timeZone,
  );
  if (bed.getTime() < cursor.getTime() + 20 * 60000) {
    bed = new Date(cursor.getTime() + Math.min(windowMin, 45) * 60000);
    const late = zonedParts(bed, timeZone);
    const lateMin = late.hour * 60 + late.minute;
    if (lateMin > 21 * 60 + 30 && late.hour >= 12) {
      bed = zonedWallTimeToUtc(late.year, late.month, late.day, 21, 30, timeZone);
    }
  }
  return bed;
}

function netOverlap(
  session: GuidanceSession,
  end: Date,
  windowStart: Date,
  windowEnd: Date,
): number {
  const gross = overlapMinutes(session.startedAt, end, windowStart, windowEnd);
  let paused = 0;
  for (const pause of session.pauses ?? []) {
    const pauseEnd = pause.endedAt ?? end;
    if (pauseEnd.getTime() <= pause.startedAt.getTime()) continue;
    paused += overlapMinutes(pause.startedAt, pauseEnd, windowStart, windowEnd);
  }
  return Math.max(0, gross - paused);
}

function computeStats(
  sessions: GuidanceSession[],
  now: Date,
  timeZone: string,
  norms: SleepNorm,
): SleepStats {
  const todayStart = startOfLocalDay(now, timeZone);
  const todayEnd = nextLocalMidnight(now, timeZone);
  const last24Start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayKey = zonedDateKey(now, timeZone);
  let todaySleep = 0;
  let todayNap = 0;
  let todayNight = 0;
  let todayNapCount = 0;
  let last24 = 0;
  let longest = 0;
  for (const session of sessions) {
    const end = session.endedAt ?? now;
    if (end.getTime() <= session.startedAt.getTime()) continue;
    longest = Math.max(longest, netOverlap(session, end, session.startedAt, end));
    todaySleep += netOverlap(session, end, todayStart, todayEnd);
    last24 += netOverlap(session, end, last24Start, now);
    if (session.kind === 'NAP') {
      todayNap += netOverlap(session, end, todayStart, todayEnd);
      if (zonedDateKey(session.startedAt, timeZone) === todayKey) todayNapCount += 1;
    } else {
      todayNight += netOverlap(session, end, todayStart, todayEnd);
    }
  }
  const week = computeWeek(sessions, now, timeZone, norms.totalTargetMin);
  const prior = week.filter((day) => day.date !== todayKey && day.sleepMin > 0);
  const sample = prior.length > 0 ? prior : week.filter((day) => day.sleepMin > 0);
  const bedtimes: number[] = [];
  const wakes: number[] = [];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  for (const session of sessions) {
    if (session.kind !== 'NIGHT') continue;
    if (session.startedAt >= weekAgo) {
      bedtimes.push(bedtimeMinute(session.startedAt, timeZone));
    }
    if (session.endedAt && session.endedAt >= weekAgo) {
      wakes.push(minutesOf(session.endedAt, timeZone));
    }
  }
  return {
    todaySleepMin: Math.round(todaySleep),
    todayNapCount,
    todayNapMin: Math.round(todayNap),
    todayNightMin: Math.round(todayNight),
    last24hSleepMin: Math.round(last24),
    targetSleepMin: Math.round(norms.totalTargetMin),
    sleepDebtMin: Math.round(norms.totalTargetMin - last24),
    weekAvgSleepMin: sample.length ? Math.round(average(sample.map((day) => day.sleepMin))) : null,
    weekAvgNapCount: sample.length ? Math.round(average(sample.map((day) => day.napCount)) * 10) / 10 : null,
    bedtimeClock: bedtimes.length ? clockFromMinutes(median(bedtimes)) : null,
    wakeClock: wakes.length ? clockFromMinutes(median(wakes)) : null,
    bedtimeSpreadMin: bedtimes.length >= 2 ? Math.round(mad(bedtimes)) : null,
    longestStretchMin: Math.round(longest),
  };
}

function computeWeek(
  sessions: GuidanceSession[],
  now: Date,
  timeZone: string,
  targetMin: number,
): WeekDay[] {
  const today = zonedParts(now, timeZone);
  const days: WeekDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addCalendarDays(today.year, today.month, today.day, -offset);
    const start = zonedWallTimeToUtc(date.year, date.month, date.day, 0, 0, timeZone);
    const next = addCalendarDays(date.year, date.month, date.day, 1);
    const end = zonedWallTimeToUtc(next.year, next.month, next.day, 0, 0, timeZone);
    const key = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
    let sleepMin = 0;
    let napCount = 0;
    for (const session of sessions) {
      const sessionEnd = session.endedAt ?? now;
      sleepMin += netOverlap(session, sessionEnd, start, end);
      if (session.kind === 'NAP' && zonedDateKey(session.startedAt, timeZone) === key) {
        napCount += 1;
      }
    }
    days.push({
      date: key,
      label: new Intl.DateTimeFormat('uk-UA', {
        timeZone,
        weekday: 'short',
      }).format(start),
      sleepMin: Math.round(sleepMin),
      napCount,
      targetMin: Math.round(targetMin),
    });
  }
  return days;
}

function computeBlocks(
  sessions: GuidanceSession[],
  now: Date,
  timeZone: string,
): TodayBlock[] {
  const start = startOfLocalDay(now, timeZone);
  const end = nextLocalMidnight(now, timeZone);
  const span = end.getTime() - start.getTime();
  const blocks: TodayBlock[] = [];
  for (const session of sessions) {
    const sessionEnd = session.endedAt ?? now;
    const from = Math.max(session.startedAt.getTime(), start.getTime());
    const to = Math.min(sessionEnd.getTime(), end.getTime());
    if (to <= from || span <= 0) continue;
    blocks.push({
      id: session.id,
      kind: session.kind,
      left: ((from - start.getTime()) / span) * 100,
      width: ((to - from) / span) * 100,
      label: `${formatClock(new Date(from), timeZone)}–${session.endedAt ? formatClock(new Date(to), timeZone) : 'зараз'}`,
    });
  }
  return blocks;
}

function wakeSamples(
  sessions: GuidanceSession[],
  timeZone: string,
): Map<number, number[]> {
  const samples = new Map<number, number[]>();
  const ordered = [...sessions].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  for (let index = 1; index < ordered.length; index += 1) {
    const current = ordered[index];
    const previous = ordered[index - 1];
    if (!previous.endedAt) continue;
    const gap = (current.startedAt.getTime() - previous.endedAt.getTime()) / 60000;
    if (gap < 20 || gap > 360) continue;
    const slot = slotOf(current, ordered, timeZone);
    const list = samples.get(slot) ?? [];
    list.push(gap);
    samples.set(slot, list);
  }
  return samples;
}

function durationSamples(
  sessions: GuidanceSession[],
  timeZone: string,
): Map<number, number[]> {
  const samples = new Map<number, number[]>();
  for (const session of sessions) {
    if (!session.endedAt) continue;
    const mins = (session.endedAt.getTime() - session.startedAt.getTime()) / 60000;
    if (mins < 10 || mins > 12 * 60) continue;
    const slot = slotOf(session, sessions, timeZone);
    const list = samples.get(slot) ?? [];
    list.push(mins);
    samples.set(slot, list);
  }
  return samples;
}

function slotOf(
  session: GuidanceSession,
  all: GuidanceSession[],
  timeZone: string,
): number {
  if (session.kind === 'NIGHT') return 3;
  const day = zonedDateKey(session.startedAt, timeZone);
  const earlier = all.filter(
    (item) =>
      item.kind === 'NAP' &&
      item.id !== session.id &&
      zonedDateKey(item.startedAt, timeZone) === day &&
      item.startedAt < session.startedAt,
  ).length;
  return Math.min(earlier, 2);
}

function nextSlot(
  now: Date,
  sessions: GuidanceSession[],
  timeZone: string,
): number {
  const hour = zonedParts(now, timeZone).hour;
  const day = zonedDateKey(now, timeZone);
  const naps = sessions.filter(
    (session) =>
      session.kind === 'NAP' &&
      session.endedAt !== null &&
      zonedDateKey(session.startedAt, timeZone) === day,
  ).length;
  if (hour >= 17 || naps >= 3) return 3;
  return naps;
}

function shortNapPenalty(closed: ClosedSession[], now: Date): number {
  const recent = closed
    .filter(
      (session) =>
        session.kind === 'NAP' &&
        now.getTime() - session.endedAt.getTime() < 16 * 60 * 60000,
    )
    .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
    .slice(0, 2);
  if (recent.length < 2) return 0;
  const short = recent.every(
    (session) =>
      (session.endedAt.getTime() - session.startedAt.getTime()) / 60000 < 40,
  );
  return short ? 15 : 0;
}

function latestEnd(closed: ClosedSession[]): Date | null {
  let latest: Date | null = null;
  for (const session of closed) {
    if (!latest || session.endedAt > latest) latest = session.endedAt;
  }
  return latest;
}

function blend(
  norm: number,
  samples: number[],
): { value: number; personalized: boolean } {
  const recent = samples.slice(-8);
  if (recent.length === 0) return { value: norm, personalized: false };
  const value = Math.round(
    (PRIOR_WEIGHT * norm + recent.length * median(recent)) /
      (PRIOR_WEIGHT + recent.length),
  );
  return { value, personalized: true };
}

function windowAt(norms: SleepNorm, slot: number): number {
  const index = clamp(Math.round(slot), 0, 3) as 0 | 1 | 2 | 3;
  return norms.wakeWindowsMin[index];
}

function minutesOf(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

function bedtimeMinute(date: Date, timeZone: string): number {
  const mins = minutesOf(date, timeZone);
  return mins < 12 * 60 ? mins + 24 * 60 : mins;
}

function clockFromMinutes(mins: number): string {
  const normalized = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mad(values: number[]): number {
  const mid = median(values);
  return median(values.map((value) => Math.abs(value - mid)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeNapTarget(value: number | null | undefined, weeks: number): number {
  if (value === 2 || value === 3 || value === 4) return value;
  if (weeks < 20) return 4;
  if (weeks < 36) return 3;
  return 2;
}

function settleMinutes(weeks: number): number {
  if (weeks < 16) return 20;
  if (weeks < 28) return 15;
  return 10;
}

function settleTime(nextSleep: Date, weeks: number, timeZone: string): Date {
  const raw = new Date(nextSleep.getTime() - settleMinutes(weeks) * 60000);
  const rounded = roundLocalTo10(raw, timeZone);
  if (rounded.getTime() >= nextSleep.getTime()) {
    return new Date(nextSleep.getTime() - 10 * 60000);
  }
  return rounded;
}

function roundLocalTo10(date: Date, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  const rounded = Math.round((parts.hour * 60 + parts.minute) / 10) * 10;
  const dayShift = rounded >= 24 * 60 ? 1 : 0;
  const minutes = ((rounded % (24 * 60)) + 24 * 60) % (24 * 60);
  const day = addCalendarDays(parts.year, parts.month, parts.day, dayShift);
  return zonedWallTimeToUtc(
    day.year,
    day.month,
    day.day,
    Math.floor(minutes / 60),
    minutes % 60,
    timeZone,
  );
}

function weekNoteFor(weeks: number): string | null {
  if (weeks >= 14 && weeks <= 17) {
    return 'Ближче до 4 місяців сон часто перебудовується: цикли довшають, нічні пробудження звичні. План лишається підказкою — якщо втомлена раніше, вкладіть раніше.';
  }
  if (weeks >= 18 && weeks <= 20) {
    return 'Цей тиждень часто більш неспокійний, сни можуть бути коротшими. Це не означає, що графік зламався.';
  }
  if (
    (weeks >= 4 && weeks <= 6) ||
    (weeks >= 7 && weeks <= 9) ||
    (weeks >= 11 && weeks <= 13) ||
    (weeks >= 25 && weeks <= 27)
  ) {
    return 'У такі тижні сон часто стає уривчастим. Орієнтир не скасовуйте, але дивіться на втому, а не лише на годинник.';
  }
  return null;
}

type BandName = AgeBand;

function ageBand(weeks: number): BandName {
  if (weeks < 8) return 'newborn';
  if (weeks < 12) return 'twoMonths';
  if (weeks < 16) return 'threeMonths';
  if (weeks < 20) return 'fourMonths';
  if (weeks < 28) return 'fiveToSix';
  return 'older';
}

function normsForWeeks(weeks: number): SleepNorm {
  const band = ageBand(weeks);
  switch (band) {
    case 'newborn':
      return norm(15.5 * 60, [60, 70, 80, 90], 45, 8 * 60);
    case 'twoMonths':
      return norm(15 * 60, [75, 90, 105, 120], 50, 9.5 * 60);
    case 'threeMonths':
      return norm(14.75 * 60, [90, 105, 120, 135], 55, 10.5 * 60);
    case 'fourMonths':
      return norm(14.5 * 60, [105, 120, 140, 155], 60, 11 * 60);
    case 'fiveToSix':
      return norm(14 * 60, [120, 150, 165, 180], 75, 11 * 60);
    case 'older':
      return norm(13.5 * 60, [150, 180, 210, 240], 90, 11 * 60);
    default: {
      const exhaustive: never = band;
      return exhaustive;
    }
  }
}

function norm(
  totalTargetMin: number,
  wakeWindowsMin: [number, number, number, number],
  typicalNapMin: number,
  typicalNightMin: number,
): SleepNorm {
  return {
    totalTargetMin,
    wakeWindowsMin,
    typicalNapMin,
    typicalNightMin,
    bedtimeStartMin: 18 * 60 + 30,
    bedtimeEndMin: 20 * 60 + 30,
  };
}
