import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Loader } from '../../shared/loader.component';
import { formatMinutes } from '../sleep/sleep-clock';
import type { SleepKind, SleepSession } from '../sleep/sleep.model';
import { SleepTimePipe } from '../sleep/sleep-time.pipe';
import { HomeService } from './home.service';

@Component({
  selector: 'app-home-sleep-card',
  imports: [RouterLink, SleepTimePipe, Loader],
  templateUrl: './home-sleep-card.component.html',
  styleUrl: './home-sleep-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeSleepCard {
  private readonly home = inject(HomeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly snapshot = this.home.snapshot;
  readonly busy = signal(false);
  readonly sleepDuration = formatMinutes;

  isPaused(active: SleepSession | null): boolean {
    return !!active?.pauses.some((pause) => pause.endedAt === null);
  }

  alternateKind(suggested: SleepKind): SleepKind {
    return suggested === 'NIGHT' ? 'NAP' : 'NIGHT';
  }

  start(kind: SleepKind): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.home
      .startSleep(kind)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => undefined });
  }

  togglePause(active: SleepSession): void {
    if (this.busy()) return;
    this.busy.set(true);
    const request$ = this.isPaused(active)
      ? this.home.resumeSleep()
      : this.home.pauseSleep();
    request$
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => undefined });
  }

  stop(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.home
      .stopSleep()
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => undefined });
  }
}
