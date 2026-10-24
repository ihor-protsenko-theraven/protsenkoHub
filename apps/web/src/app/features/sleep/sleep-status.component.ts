import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { asleepMs, formatMinutes } from './sleep-clock';
import { SLEEP_UI } from './sleep.config';
import type { SleepSession } from './sleep.model';
import { SleepTickerService } from './sleep-ticker.service';

@Component({
  selector: 'app-sleep-status',
  templateUrl: './sleep-status.component.html',
  styleUrl: './sleep-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SleepStatus {
  private readonly ticker = inject(SleepTickerService);
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
