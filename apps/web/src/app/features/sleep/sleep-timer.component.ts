import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { asleepMs, elapsedMs, formatClockDuration } from './sleep-clock';
import type { PauseSpan, SleepClockMode } from './sleep.model';
import { SleepTickerService } from './sleep-ticker.service';

@Component({
  selector: 'app-sleep-timer',
  templateUrl: './sleep-timer.component.html',
  styleUrl: './sleep-timer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SleepTimer {
  private readonly ticker = inject(SleepTickerService);
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
