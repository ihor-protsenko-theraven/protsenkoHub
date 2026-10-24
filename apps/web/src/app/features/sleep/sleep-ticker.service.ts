import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SLEEP_UI } from './sleep.config';

@Injectable()
export class SleepTickerService {
  private readonly destroyRef = inject(DestroyRef);
  readonly second = signal(0);
  readonly minute = signal(0);
  private lastMinute = -1;

  constructor() {
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
    this.destroyRef.onDestroy(() => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }
}
