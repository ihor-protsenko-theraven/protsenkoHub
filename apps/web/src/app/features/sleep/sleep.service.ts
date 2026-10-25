import { HttpClient, httpResource } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, take, tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { API_BASE_URL } from '../../core/configs/api.config';
import { SLEEP_WIDGET_BRIDGE } from './sleep-widget-bridge';
import { SleepKind, SleepOverview, SleepPayload, SleepSession } from './sleep.model';

@Injectable()
export class SleepService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly widget = inject(SLEEP_WIDGET_BRIDGE);
  private readonly destroyRef = inject(DestroyRef);
  readonly widgetSyncError = signal('');
  readonly overview = httpResource<SleepOverview>(() => ({
    url: `${API_BASE_URL}/children/sleep`,
    withCredentials: true,
  }));
  private readonly overviewStatus$ = toObservable(this.overview.status);

  async syncWidget(): Promise<void> {
    try {
      await this.widget.refresh(this.http);
      this.widgetSyncError.set('');
    } catch {
      this.widgetSyncError.set('Не вдалося оновити віджет. Перевірте з’єднання й відкрийте цей екран ще раз.');
    }
  }

  private refresh(): void {
    if (!this.overview.reload()) {
      this.overviewStatus$.pipe(
        filter((status) =>
          (status === 'resolved' || status === 'error' || status === 'local') &&
          !this.overview.isLoading(),
        ),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(() => this.overview.reload());
    }
    void this.syncWidget();
  }

  start(payload: { kind: SleepKind; startedAt?: string; notes?: string | null }) {
    return this.api
      .post<{ session: SleepSession; resumed: boolean }>('/children/sleep/start', payload)
      .pipe(tap(() => this.refresh()));
  }

  stop(payload: { endedAt?: string; notes?: string | null }) {
    return this.api
      .post<{ session: SleepSession }>('/children/sleep/stop', payload)
      .pipe(tap(() => this.refresh()));
  }

  pause(payload: { startedAt?: string } = {}) {
    return this.api
      .post<{ session: SleepSession; alreadyPaused: boolean }>('/children/sleep/pause', payload)
      .pipe(tap(() => this.refresh()));
  }

  resume(payload: { endedAt?: string } = {}) {
    return this.api
      .post<{ session: SleepSession }>('/children/sleep/resume', payload)
      .pipe(tap(() => this.refresh()));
  }

  updatePause(id: string, payload: { startedAt?: string; endedAt?: string | null }) {
    return this.api
      .patch<{ session: SleepSession }>(`/children/sleep/pauses/${id}`, payload)
      .pipe(tap(() => this.refresh()));
  }

  createSavedPause(id: string, payload: { startedAt: string; endedAt: string }) {
    return this.api
      .post<{ session: SleepSession }>(`/children/sleep/${id}/pauses`, payload)
      .pipe(tap(() => this.refresh()));
  }

  create(payload: SleepPayload) {
    return this.api
      .post<{ session: SleepSession }>('/children/sleep', payload)
      .pipe(tap(() => this.refresh()));
  }

  update(id: string, payload: Partial<SleepPayload>) {
    return this.api
      .patch<{ session: SleepSession }>(`/children/sleep/${id}`, payload)
      .pipe(tap(() => this.refresh()));
  }

  remove(id: string) {
    return this.api.delete<{ ok: boolean }>(`/children/sleep/${id}`).pipe(tap(() => this.refresh()));
  }

  saveProfile(payload: { napTarget: number | null }) {
    return this.api
      .patch<{ napTarget: number | null }>('/children/sleep/profile', payload)
      .pipe(tap(() => this.refresh()));
  }
}
