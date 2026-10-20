import type { PauseSpan } from './sleep.model';

export function elapsedMs(startedAtIso: string, nowMs: number, clockOffsetMs: number): number {
  const start = new Date(startedAtIso).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, nowMs + clockOffsetMs - start);
}

export function asleepMs(
  startedAtIso: string,
  endedAtIso: string | null,
  pauses: PauseSpan[],
  nowMs: number,
  clockOffsetMs: number,
): number {
  const now = nowMs + clockOffsetMs;
  const start = new Date(startedAtIso).getTime();
  const end = endedAtIso ? new Date(endedAtIso).getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  let paused = 0;
  for (const pause of pauses) {
    const pauseStart = new Date(pause.startedAt).getTime();
    const pauseEnd = pause.endedAt ? new Date(pause.endedAt).getTime() : end;
    if (!Number.isFinite(pauseStart) || !Number.isFinite(pauseEnd)) continue;
    const from = Math.max(pauseStart, start);
    const to = Math.min(pauseEnd, end);
    if (to > from) paused += to - from;
  }
  return Math.max(0, Math.min(end, now) - start - paused);
}

export function formatClockDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins} хв`;
  if (mins === 0) return `${hours} год`;
  return `${hours} год ${mins} хв`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
