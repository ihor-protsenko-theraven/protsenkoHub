import { HttpClient, httpResource } from '@angular/common/http';
import { computed, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, finalize, take, tap } from 'rxjs';
import { isNativeApp } from '../../core/configs/native-platform.config';
import { ApiService } from '../../core/services/api.service';
import { API_BASE_URL } from '../../core/configs/api.config';
import { SLEEP_WIDGET_BRIDGE } from './sleep-widget-bridge';
import { SleepKind, SleepOverview, SleepPayload, SleepSession } from './sleep.model';
import { SLEEP_UI } from './sleep.config';

@Injectable()
export class SleepService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly widget = inject(SLEEP_WIDGET_BRIDGE);
  private readonly destroyRef = inject(DestroyRef);
  private readonly native = isNativeApp();
  private checkingVersion = false;
  readonly widgetSyncError = signal('');
  readonly overview = httpResource<SleepOverview>(() => ({
    url: `${API_BASE_URL}/children/sleep`,
    withCredentials: true,
    cache: 'no-store',
    params: this.native ? { widget: '1' } : undefined,
  }));
  private readonly overviewStatus$ = toObservable(this.overview.status);

  constructor() {
    if (!this.native) return;
    const resolved = computed(() => this.overview.hasValue() ? this.overview.value() : undefined);
    toObservable(resolved).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((overview) => {
      if (overview?.widget) void this.syncWidget(overview);
    });
  }

  private async syncWidget(overview: SleepOverview): Promise<void> {
    if (!overview.widget) return;
    try {
      await this.widget.publish(overview.widget, () =>
        !this.destroyRef.destroyed && this.overview.hasValue() && this.overview.value() === overview,
      );
      this.widgetSyncError.set('');
    } catch {
      this.widgetSyncError.set('Не вдалося оновити віджет. Перевірте з’єднання й відкрийте цей екран ще раз.');
    }
  }

  refreshIfChanged(): void {
    if (this.checkingVersion || this.overview.isLoading()) return;
    const overview = this.overview.hasValue() ? this.overview.value() : undefined;
    if (overview?.version === undefined) {
      this.overview.reload();
      return;
    }
    this.checkingVersion = true;
    this.http.get<{ version: number }>(`${API_BASE_URL}/children/sleep/status`, {
      withCredentials: true,
      cache: 'no-store',
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.checkingVersion = false; }),
    ).subscribe({
      next: ({ version }) => {
        if (this.overview.hasValue() && this.overview.value() === overview &&
            (version !== overview.version ||
             Date.now() - Date.parse(overview.serverNow) >= SLEEP_UI.guidanceRefreshMs)) {
          this.overview.reload();
        }
      },
      error: () => undefined,
    });
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

  continueSaved(id: string) {
    return this.api
      .post<{ session: SleepSession }>(`/children/sleep/${id}/continue`, {})
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
