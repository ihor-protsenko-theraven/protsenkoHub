import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, computed, inject, input, signal } from '@angular/core';
import { SLEEP_UI } from './sleep.config';
import { asleepMs, elapsedMs, formatClockDuration, formatMinutes } from './sleep-clock';
import type { PauseSpan, SleepSession } from './sleep.model';

export type SleepClockMode = 'asleep' | 'paused' | 'awake';

@Injectable()
export class SleepTicker {
  readonly second = signal(0);
  readonly minute = signal(0);
  private lastMinute = -1;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      this.second.update((value) => value + 1);
      const minute = Math.floor(Date.now() / SLEEP_UI.minuteMs);
      if (minute !== this.lastMinute) {
        this.lastMinute = minute;
        this.minute.set(minute);
      }
    };
    const id = window.setInterval(beat, SLEEP_UI.tickMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisible);
    destroyRef.onDestroy(() => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }
}

@Component({
  selector: 'app-sleep-timer',
  template: `{{ text() }}`,
  styles: `:host { display: inline; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SleepTimer {
  private readonly ticker = inject(SleepTicker);
  readonly mode = input.required<SleepClockMode>();
  readonly startedAt = input<string | null>(null);
  readonly pauses = input<readonly PauseSpan[]>([]);
  readonly offset = input(0);

  readonly text = computed(() => {
    this.ticker.second();
    const startedAt = this.startedAt();
    const offset = this.offset();
    const now = Date.now();
    const mode = this.mode();
    switch (mode) {
      case 'asleep':
        return startedAt ? formatClockDuration(asleepMs(startedAt, null, this.pauses(), now, offset)) : '—';
      case 'paused':
      case 'awake':
        return startedAt ? formatClockDuration(elapsedMs(startedAt, now, offset)) : '—';
      default: {
        const exhaustive: never = mode;
        return exhaustive;
      }
    }
  });
}

@Component({
  selector: 'app-sleep-status',
  template: `<p class="sr" role="status">{{ spoken() }}</p>`,
  styles: `.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SleepStatus {
  private readonly ticker = inject(SleepTicker);
  readonly headline = input('');
  readonly active = input<SleepSession | null>(null);
  readonly offset = input(0);
  readonly babyName = input('Дитина');

  readonly spoken = computed(() => {
    this.ticker.minute();
    const active = this.active();
    if (!active) return this.headline();
    const pauses = active.pauses ?? [];
    const minutes = Math.floor(asleepMs(active.startedAt, null, pauses, Date.now(), this.offset()) / SLEEP_UI.minuteMs);
    const open = pauses.some((pause) => pause.endedAt === null);
    return open
      ? `Сон на паузі. Вже триває ${formatMinutes(minutes)}.`
      : `${this.babyName() || 'Дитина'} спить уже ${formatMinutes(minutes)}.`;
  });
}
