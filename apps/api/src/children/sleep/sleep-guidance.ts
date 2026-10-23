import {
  addCalendarDays,
  formatClock,
  formatMinutes,
  median,
  nextLocalMidnight,
  overlapMinutes,
  pad,
  STALE_SLEEP_MIN,
  startOfLocalDay,
  suggestedKind,
  zonedDateKey,
  zonedParts,
  zonedWallTimeToUtc,
} from './sleep-time';
import { HOUSEHOLD } from '../../config/household.config';
import { SLEEP_GUIDANCE } from './sleep-guidance.config';
import type {
  BedtimeAnchor,
  ClosedSession,
  GuidanceBasis,
  GuidanceInput,
  GuidanceSession,
  ScheduleItem,
  SleepGuidance,
  SleepKindName,
  SleepNorm,
  SleepSignal,
  SleepStats,
  TodayBlock,
  WeekDay,
} from './sleep-guidance.model';

const G = SLEEP_GUIDANCE;

/**
 * Recommendations combine three public signals:
 * 1. Age norms for wake windows and total sleep (AAP: 12–16h at 4–12 months;
 *    4-month wake windows lengthen from about 1h 45m to 2h 35m).
 * 2. The baby's own recent median, blended with the norm. Gaps too long to be
 *    one wake window are ignored, so a missed log does not become a new habit.
 *    Little data keeps the norm in charge.
 * 3. A simplified two-process model (Borbély): sleep debt shortens the next
 *    window. Extra sleep does not delay the morning nap. Bedtime stays inside
 *    18:30–20:30 and, once several nights exist, leans toward her own time.
 */

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
    [...ordered].reverse().find((session) => session.endedAt === null) ?? null;
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
  const recentSessions = ordered.filter(
    (session) =>
      session.startedAt.getTime() >=
      input.now.getTime() - G.personalizationLookbackDays * G.dayMs,
  );
  const wakeBySlot = wakeSamples(recentSessions, input.timeZone, norms);
  const durationBySlot = durationSamples(recentSessions, input.timeZone);
  const anchor = bedtimeAnchor(ordered, input.now, input.timeZone);
  const suggested = suggestedKind(input.now, input.timeZone);
  const base = {
    howItWorks: [...G.copy.howItWorks],
    disclaimer: G.copy.disclaimer,
    suggestedKind: suggested,
    stats,
    todayBlocks,
    week,
  };

  if (active) {
    const minutes =
      (input.now.getTime() - active.startedAt.getTime()) / G.minuteMs;
    if (minutes >= STALE_SLEEP_MIN) {
      return {
        ...base,
        headline: G.copy.staleHeadline,
        detail: G.copy.staleDetail,
        ...rhythm,
        nextSleepAt: null,
        prepareAt: null,
        expectedWakeAt: null,
        wakeWindowMin: null,
        basis: 'stale',
        signals: buildSignals(input, stats, null, G.copy.sourceUnfinished),
        schedule: [],
        scheduleNote: null,
        activeStale: true,
        awakeSince: null,
      };
    }
    const slot = slotOf(active, ordered, input.timeZone);
    const prior =
      active.kind === 'NIGHT' ? norms.typicalNightMin : napPrior(norms, slot);
    const typical = blend(prior, durationBySlot.get(slot) ?? []);
    const expected = expectedWake(
      active,
      typical.value,
      input.now,
      input.timeZone,
    );
    const label =
      active.kind === 'NIGHT'
        ? G.copy.sleepingLabel.night
        : G.copy.sleepingLabel.nap;
    const windows = adjustedWindows(norms, wakeBySlot, 0);
    return {
      ...base,
      headline: `${input.babyName?.trim() || 'Дитина'} спить. Цей ${label} зазвичай триває ${formatMinutes(typical.value)}.`,
      detail: `Орієнтовне пробудження близько ${formatClock(expected, input.timeZone)}. ${G.copy.sleepingDetail}`,
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
          ? G.copy.sourcePersonalizedDuration
          : G.copy.sourceAgeDuration,
      ),
      schedule: buildSchedule({
        now: input.now,
        timeZone: input.timeZone,
        norms,
        windows,
        cursor: expected.getTime() > input.now.getTime() ? expected : input.now,
        slot: Math.min(slot + 1, G.schedule.bedtimeSlot),
        durationBySlot,
        nightMin: norms.typicalNightMin,
        bedtimeAnchor: anchor,
        napTarget,
        ageWeeks: input.ageWeeks,
        example: false,
      }),
      scheduleNote: G.copy.afterWakeNote,
      activeStale: false,
      awakeSince: null,
    };
  }

  const awakeSince = latestEnd(closed);
  const slot = nextSlot(input.now, ordered, input.timeZone, napTarget);
  const debtMin = norms.totalTargetMin - stats.last24hSleepMin;
  const debtAdjust =
    !stats.hasFullDayHistory || debtMin <= G.debt.triggerMin
      ? 0
      : -Math.min(
          G.debt.maxShortenMin,
          Math.round(debtMin / G.debt.minutesPerStep),
        );
  const penalty = shortNapPenalty(closed, input.now);
  const blended = blend(windowAt(norms, slot), wakeBySlot.get(slot) ?? []);
  const windowMin = clamp(
    blended.value + debtAdjust - penalty,
    G.windowClamp.min,
    norms.maxWakeWindowMin,
  );
  const windows = adjustedWindows(norms, wakeBySlot, debtAdjust);
  windows[slot] = windowMin;
  const basis: GuidanceBasis =
    penalty > 0 || Math.abs(debtAdjust) >= G.debt.noticeableMin
      ? 'debt'
      : blended.personalized
        ? 'blended'
        : 'age';
  const source = sourceText(
    blended.personalized,
    basis,
    input.assumedAge,
    penalty,
    debtAdjust,
  );
  const detail = detailText(windowMin, source, debtAdjust, penalty, debtMin);

  if (!awakeSince) {
    const morning = zonedWallTimeToUtc(
      zonedParts(input.now, input.timeZone).year,
      zonedParts(input.now, input.timeZone).month,
      zonedParts(input.now, input.timeZone).day,
      G.exampleWakeHour,
      0,
      input.timeZone,
    );
    return {
      ...base,
      headline: `Поки немає записів. Для віку «${input.ageLabel}» перше вікно неспання близько ${formatMinutes(windowAt(norms, 0))}.`,
      detail: G.copy.emptyDetail,
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
        durationBySlot,
        nightMin: norms.typicalNightMin,
        bedtimeAnchor: anchor,
        napTarget,
        ageWeeks: input.ageWeeks,
        example: true,
      }),
      scheduleNote: G.copy.exampleNote,
      activeStale: false,
      awakeSince: null,
    };
  }

  const awakeMin = (input.now.getTime() - awakeSince.getTime()) / G.minuteMs;
  const nextAt = roundLocalTo10(
    new Date(awakeSince.getTime() + windowMin * G.minuteMs),
    input.timeZone,
  );
  const overdue =
    nextAt.getTime() < input.now.getTime() - G.overdueGraceMin * G.minuteMs;
  const prepareAt = settleTime(nextAt, input.ageWeeks, input.timeZone);
  const clock = formatClock(nextAt, input.timeZone);
  let headline: string;
  if (awakeMin > G.longAwakeMin) {
    headline = `Останнє пробудження було о ${formatClock(awakeSince, input.timeZone)}, вже ${formatMinutes(awakeMin)}. ${G.copy.longAwake}`;
  } else if (awakeMin < windowMin - G.sweetSpot.earlyMarginMin) {
    headline = `${G.copy.earlyPrefix} ${clock} (через ${formatMinutes(windowMin - awakeMin)}).`;
  } else if (awakeMin <= windowMin + G.sweetSpot.lateMarginMin) {
    headline = G.copy.sweetSpot;
  } else {
    headline = G.copy.overtired;
  }

  return {
    ...base,
    ...rhythm,
    headline,
    detail,
    nextSleepAt: overdue ? null : nextAt.toISOString(),
    prepareAt: overdue ? null : prepareAt.toISOString(),
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
      durationBySlot,
      nightMin: norms.typicalNightMin,
      bedtimeAnchor: anchor,
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
  if (debtAdjust <= -G.debt.noticeableMin) {
    text += G.copy.debtEarlier;
  } else if (Math.abs(debtMin) <= G.debt.nearTargetMin && penalty === 0) {
    text += G.copy.nearTarget;
  }
  if (penalty >= G.shortNap.pairPenaltyMin) {
    text += G.copy.pairShort;
  } else if (penalty > 0) {
    text += G.copy.singleShort;
  }
  return text;
}

function sourceText(
  personalized: boolean,
  basis: GuidanceBasis,
  assumedAge: boolean,
  penalty: number,
  debtAdjust: number,
): string {
  if (basis === 'debt' && debtAdjust === 0 && penalty > 0) {
    return personalized
      ? G.copy.sourceShortPersonalized
      : G.copy.sourceShortAge;
  }
  if (basis === 'debt' && personalized) {
    return G.copy.sourceDebtPersonalized;
  }
  if (basis === 'debt') return G.copy.sourceDebtAge;
  if (personalized) return G.copy.sourceBlended;
  if (assumedAge) return G.copy.sourceAssumedAge;
  return G.copy.sourceAge;
}

function buildSignals(
  input: GuidanceInput,
  stats: SleepStats,
  windowMin: number | null,
  source: string,
): SleepSignal[] {
  const debt = !stats.hasFullDayHistory
    ? G.copy.debtIncomplete
    : stats.sleepDebtMin > G.debt.signalBandMin
      ? `${formatMinutes(stats.sleepDebtMin)} ${G.copy.debtUnder}`
      : stats.sleepDebtMin < -G.debt.signalBandMin
        ? `${formatMinutes(Math.abs(stats.sleepDebtMin))} ${G.copy.debtOver}`
        : G.copy.debtNear;
  const signals: SleepSignal[] = [
    {
      label: G.copy.signalAge,
      value: input.assumedAge
        ? `${input.ageLabel} ${G.copy.signalAgeHint}`
        : input.ageLabel,
    },
    {
      label: G.copy.signalDay,
      value: `${formatMinutes(stats.last24hSleepMin)} із ${formatMinutes(stats.targetSleepMin)}`,
    },
    { label: G.copy.signalDebt, value: debt },
  ];
  if (windowMin !== null) {
    signals.push({
      label: G.copy.signalWindow,
      value: formatMinutes(windowMin),
    });
  }
  signals.push({ label: G.copy.signalSource, value: source });
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
      G.windowClamp.min,
      norms.maxWakeWindowMin,
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
  durationBySlot: Map<number, number[]>;
  nightMin: number;
  bedtimeAnchor: BedtimeAnchor | null;
  napTarget: number;
  ageWeeks: number;
  example: boolean;
}): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const minNap =
    options.ageWeeks >= G.schedule.catnapFromWeeks
      ? G.schedule.olderMinNap
      : G.schedule.youngerMinNap;
  let cursor = options.cursor;
  let slot = options.slot;
  while (
    slot < options.napTarget &&
    slot < G.schedule.maxNaps &&
    items.length < G.schedule.maxNaps
  ) {
    const windowSlot = Math.min(slot, G.schedule.maxNapSlot);
    const windowMin =
      options.windows[windowSlot] ?? windowAt(options.norms, windowSlot);
    const length = blend(
      napPrior(options.norms, slot),
      options.durationBySlot.get(windowSlot) ?? [],
    ).value;
    if (length < minNap) break;
    const start = roundLocalTo10(
      new Date(cursor.getTime() + windowMin * G.minuteMs),
      options.timeZone,
    );
    let end = roundLocalTo10(
      new Date(start.getTime() + length * G.minuteMs),
      options.timeZone,
    );
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + minNap * G.minuteMs);
    }
    const startMin = minutesOf(start, options.timeZone);
    const endMin = minutesOf(end, options.timeZone);
    if (
      startMin >= G.schedule.lastNapStartMin ||
      endMin >= G.schedule.lastNapEndMin
    ) {
      break;
    }
    cursor = end;
    const currentSlot = slot;
    slot += 1;
    if (!options.example && end.getTime() < options.now.getTime()) continue;
    items.push(
      item(
        G.copy.napLabel(currentSlot + 1),
        'NAP',
        start,
        end,
        options.timeZone,
      ),
    );
  }
  const bed = roundLocalTo10(
    placeBedtime(
      cursor,
      options.windows[G.schedule.bedtimeSlot] ??
        windowAt(options.norms, G.schedule.bedtimeSlot),
      options.norms,
      options.timeZone,
      options.bedtimeAnchor,
    ),
    options.timeZone,
  );
  if (
    options.example ||
    bed.getTime() >
      options.now.getTime() - G.bedtime.showIfWithinMin * G.minuteMs
  ) {
    items.push(
      item(
        G.copy.nightLabel,
        'NIGHT',
        bed,
        new Date(bed.getTime() + options.nightMin * G.minuteMs),
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
  anchor: BedtimeAnchor | null,
): Date {
  const proposed = new Date(cursor.getTime() + windowMin * G.minuteMs);
  let bed = clampBedtime(proposed, norms, timeZone);
  if (anchor && anchor.count >= G.bedtime.minNights) {
    const current = bedtimeMinute(bed, timeZone);
    const blended = Math.round(
      (G.priorWeight * current + anchor.count * anchor.minute) /
        (G.priorWeight + anchor.count),
    );
    const minute = clamp(blended, norms.bedtimeStartMin, norms.bedtimeEndMin);
    bed = clockOnSameLocalDay(bed, minute, timeZone);
  }
  if (
    bed.getTime() <
    cursor.getTime() + G.bedtime.minGapAfterWakeMin * G.minuteMs
  ) {
    bed = new Date(
      cursor.getTime() +
        Math.min(windowMin, G.bedtime.fallbackWakeMin) * G.minuteMs,
    );
    const late = zonedParts(bed, timeZone);
    const lateMin = late.hour * 60 + late.minute;
    if (lateMin > G.bedtime.lateCapMin && late.hour >= G.noonMin / 60) {
      bed = zonedWallTimeToUtc(
        late.year,
        late.month,
        late.day,
        Math.floor(G.bedtime.lateCapMin / 60),
        G.bedtime.lateCapMin % 60,
        timeZone,
      );
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
  const last24Start = new Date(now.getTime() - G.dayMs);
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
    longest = Math.max(
      longest,
      netOverlap(session, end, session.startedAt, end),
    );
    todaySleep += netOverlap(session, end, todayStart, todayEnd);
    last24 += netOverlap(session, end, last24Start, now);
    if (session.kind === 'NAP') {
      todayNap += netOverlap(session, end, todayStart, todayEnd);
      if (zonedDateKey(session.startedAt, timeZone) === todayKey)
        todayNapCount += 1;
    } else {
      todayNight += netOverlap(session, end, todayStart, todayEnd);
    }
  }
  const week = computeWeek(sessions, now, timeZone, norms.totalTargetMin);
  const prior = week.filter((day) => day.date !== todayKey && day.sleepMin > 0);
  const sample =
    prior.length > 0 ? prior : week.filter((day) => day.sleepMin > 0);
  const bedtimes: number[] = [];
  const wakes: number[] = [];
  const weekAgo = new Date(now.getTime() - G.recentStatsDays * G.dayMs);
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
    hasFullDayHistory: sessions.some(
      (session) =>
        session.startedAt <= last24Start &&
        (session.endedAt ?? now) > last24Start,
    ),
    weekAvgSleepMin: sample.length
      ? Math.round(average(sample.map((day) => day.sleepMin)))
      : null,
    weekAvgNapCount: sample.length
      ? Math.round(average(sample.map((day) => day.napCount)) * 10) / 10
      : null,
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
  for (let offset = G.recentStatsDays - 1; offset >= 0; offset -= 1) {
    const date = addCalendarDays(today.year, today.month, today.day, -offset);
    const start = zonedWallTimeToUtc(
      date.year,
      date.month,
      date.day,
      0,
      0,
      timeZone,
    );
    const next = addCalendarDays(date.year, date.month, date.day, 1);
    const end = zonedWallTimeToUtc(
      next.year,
      next.month,
      next.day,
      0,
      0,
      timeZone,
    );
    const key = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
    let sleepMin = 0;
    let napCount = 0;
    for (const session of sessions) {
      const sessionEnd = session.endedAt ?? now;
      sleepMin += netOverlap(session, sessionEnd, start, end);
      if (
        session.kind === 'NAP' &&
        zonedDateKey(session.startedAt, timeZone) === key
      ) {
        napCount += 1;
      }
    }
    days.push({
      date: key,
      label: new Intl.DateTimeFormat(HOUSEHOLD.locale, {
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
      label: `${formatClock(new Date(from), timeZone)}–${session.endedAt ? formatClock(new Date(to), timeZone) : G.copy.nowLabel}`,
    });
  }
  return blocks;
}

function asleepMinutes(session: GuidanceSession, end: Date): number {
  return netOverlap(session, end, session.startedAt, end);
}

function expectedWake(
  session: GuidanceSession,
  typicalMin: number,
  now: Date,
  timeZone: string,
): Date {
  const remainingMs =
    typicalMin * G.minuteMs - asleepMinutes(session, now) * G.minuteMs;
  const target = new Date(now.getTime() + Math.max(0, remainingMs));
  return roundLocalTo10(target, timeZone);
}

function plausibleWake(gap: number, slot: number, norms: SleepNorm): boolean {
  const norm = windowAt(norms, slot);
  const max = Math.min(
    G.wakeGap.maxMin,
    Math.round(norm * G.wakeGap.normFactor),
  );
  return gap >= G.wakeGap.minMin && gap <= max;
}

function plausibleDuration(kind: SleepKindName, mins: number): boolean {
  switch (kind) {
    case 'NAP':
      return mins >= G.duration.napMin && mins <= G.duration.napMax;
    case 'NIGHT':
      return mins >= G.duration.nightMin && mins <= G.duration.nightMax;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function napPrior(norms: SleepNorm, slot: number): number {
  if (slot <= 1) return norms.typicalNapMin;
  if (slot === 2) {
    return Math.max(
      G.napShape.laterMin,
      Math.round(norms.typicalNapMin * G.napShape.laterShare),
    );
  }
  return Math.max(
    G.napShape.lastMin,
    Math.min(
      G.napShape.lastMax,
      Math.round(norms.typicalNapMin * G.napShape.lastShare),
    ),
  );
}

function bedtimeAnchor(
  sessions: GuidanceSession[],
  now: Date,
  timeZone: string,
): BedtimeAnchor | null {
  const from = new Date(now.getTime() - G.bedtime.lookbackDays * G.dayMs);
  const minutes: number[] = [];
  for (const session of sessions) {
    if (session.kind !== 'NIGHT' || session.startedAt < from) continue;
    const minute = bedtimeMinute(session.startedAt, timeZone);
    if (minute < G.bedtime.learnFromMin || minute > G.bedtime.learnToMin)
      continue;
    minutes.push(minute);
  }
  const recent = minutes.slice(-G.recentSampleLimit);
  if (recent.length < G.bedtime.minNights) return null;
  return { minute: median(recent), count: recent.length };
}

function clampBedtime(
  proposed: Date,
  norms: SleepNorm,
  timeZone: string,
): Date {
  const parts = zonedParts(proposed, timeZone);
  let mins = parts.hour * 60 + parts.minute;
  if (mins < G.noonMin) mins += G.dayMinutes;
  let target = mins;
  if (mins < norms.bedtimeStartMin) target = norms.bedtimeStartMin;
  else if (mins > norms.bedtimeEndMin) target = norms.bedtimeEndMin;
  const dayOffset = target >= G.dayMinutes ? 1 : 0;
  const clock = target % G.dayMinutes;
  const day = addCalendarDays(parts.year, parts.month, parts.day, dayOffset);
  return zonedWallTimeToUtc(
    day.year,
    day.month,
    day.day,
    Math.floor(clock / 60),
    clock % 60,
    timeZone,
  );
}

function clockOnSameLocalDay(
  bed: Date,
  minuteOfDay: number,
  timeZone: string,
): Date {
  const parts = zonedParts(bed, timeZone);
  const clock =
    ((Math.round(minuteOfDay) % G.dayMinutes) + G.dayMinutes) % G.dayMinutes;
  return zonedWallTimeToUtc(
    parts.year,
    parts.month,
    parts.day,
    Math.floor(clock / 60),
    clock % 60,
    timeZone,
  );
}

function wakeSamples(
  sessions: GuidanceSession[],
  timeZone: string,
  norms: SleepNorm,
): Map<number, number[]> {
  const samples = new Map<number, number[]>();
  const ordered = [...sessions].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  for (let index = 1; index < ordered.length; index += 1) {
    const current = ordered[index];
    const previous = ordered[index - 1];
    if (!previous.endedAt) continue;
    const gap =
      (current.startedAt.getTime() - previous.endedAt.getTime()) / G.minuteMs;
    const slot = slotOf(current, ordered, timeZone);
    if (!plausibleWake(gap, slot, norms)) continue;
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
    const mins = asleepMinutes(session, session.endedAt);
    if (!plausibleDuration(session.kind, mins)) continue;
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
  if (session.kind === 'NIGHT') return G.schedule.bedtimeSlot;
  const day = zonedDateKey(session.startedAt, timeZone);
  const earlier = all.filter(
    (item) =>
      item.kind === 'NAP' &&
      item.id !== session.id &&
      zonedDateKey(item.startedAt, timeZone) === day &&
      item.startedAt < session.startedAt,
  ).length;
  return Math.min(earlier, G.schedule.maxNapSlot);
}

function nextSlot(
  now: Date,
  sessions: GuidanceSession[],
  timeZone: string,
  napTarget: number,
): number {
  const hour = zonedParts(now, timeZone).hour;
  const day = zonedDateKey(now, timeZone);
  const naps = sessions.filter(
    (session) =>
      session.kind === 'NAP' &&
      session.endedAt !== null &&
      zonedDateKey(session.startedAt, timeZone) === day,
  ).length;
  if (hour >= G.schedule.bedtimeSlotHour || naps >= napTarget) {
    return G.schedule.bedtimeSlot;
  }
  if (naps >= napTarget - 1 && hour >= G.schedule.lastNapHour) {
    return G.schedule.bedtimeSlot;
  }
  return Math.min(naps, G.schedule.maxNapSlot);
}

function shortNapPenalty(closed: ClosedSession[], now: Date): number {
  const recent = closed
    .filter(
      (session) =>
        session.kind === 'NAP' &&
        now.getTime() - session.endedAt.getTime() <
          G.shortNap.lookbackHours * 60 * G.minuteMs,
    )
    .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
    .slice(0, G.shortNap.recentCount);
  if (recent.length === 0) return 0;
  const lengths = recent.map((session) =>
    asleepMinutes(session, session.endedAt),
  );
  if (
    recent.length === G.shortNap.recentCount &&
    lengths.every((length) => length < G.shortNap.pairUnderMin)
  ) {
    return G.shortNap.pairPenaltyMin;
  }
  if (lengths[0] < G.shortNap.singleUnderMin)
    return G.shortNap.singlePenaltyMin;
  return 0;
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
  const recent = samples.slice(-G.recentSampleLimit);
  if (recent.length === 0) return { value: norm, personalized: false };
  const value = Math.round(
    (G.priorWeight * norm + recent.length * median(recent)) /
      (G.priorWeight + recent.length),
  );
  return { value, personalized: true };
}

function windowAt(norms: SleepNorm, slot: number): number {
  const index = clamp(Math.round(slot), 0, G.schedule.bedtimeSlot) as
    0 | 1 | 2 | 3;
  return norms.wakeWindowsMin[index];
}

function minutesOf(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

function bedtimeMinute(date: Date, timeZone: string): number {
  const mins = minutesOf(date, timeZone);
  return mins < G.noonMin ? mins + G.dayMinutes : mins;
}

function clockFromMinutes(mins: number): string {
  const normalized =
    ((Math.round(mins) % G.dayMinutes) + G.dayMinutes) % G.dayMinutes;
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

function normalizeNapTarget(
  value: number | null | undefined,
  weeks: number,
): number {
  if (
    value === G.napTarget.older ||
    value === G.napTarget.middle ||
    value === G.napTarget.young
  ) {
    return value;
  }
  if (weeks < G.napTarget.fourUntilWeek) return G.napTarget.young;
  if (weeks < G.napTarget.threeUntilWeek) return G.napTarget.middle;
  return G.napTarget.older;
}

function settleMinutes(weeks: number): number {
  if (weeks < G.settle.youngWeeks) return G.settle.youngMin;
  if (weeks < G.settle.midWeeks) return G.settle.midMin;
  return G.settle.olderMin;
}

function settleTime(nextSleep: Date, weeks: number, timeZone: string): Date {
  const raw = new Date(nextSleep.getTime() - settleMinutes(weeks) * G.minuteMs);
  const rounded = roundLocalTo10(raw, timeZone);
  if (rounded.getTime() >= nextSleep.getTime()) {
    return new Date(nextSleep.getTime() - G.clockStepMin * G.minuteMs);
  }
  return rounded;
}

function roundLocalTo10(date: Date, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  const rounded =
    Math.round((parts.hour * 60 + parts.minute) / G.clockStepMin) *
    G.clockStepMin;
  const dayShift = rounded >= G.dayMinutes ? 1 : 0;
  const minutes = ((rounded % G.dayMinutes) + G.dayMinutes) % G.dayMinutes;
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
  return (
    G.fussyWeeks.find((note) => weeks >= note.from && weeks <= note.to)?.text ??
    null
  );
}

function normsForWeeks(weeks: number): SleepNorm {
  const match =
    G.ageNorms.find((item) => weeks < item.maxWeek) ??
    G.ageNorms[G.ageNorms.length - 1];
  return {
    totalTargetMin: match.totalTargetMin,
    wakeWindowsMin: match.wakeWindowsMin,
    maxWakeWindowMin: match.maxWakeWindowMin,
    typicalNapMin: match.typicalNapMin,
    typicalNightMin: match.typicalNightMin,
    bedtimeStartMin: G.bedtime.startMin,
    bedtimeEndMin: G.bedtime.endMin,
  };
}
