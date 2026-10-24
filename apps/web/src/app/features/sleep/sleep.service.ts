import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { API_BASE_URL } from '../../core/configs/api.config';
import { SleepKind, SleepOverview, SleepPayload, SleepSession } from './sleep.model';

@Injectable()
export class SleepService {
  private readonly api = inject(ApiService);
  readonly overview = httpResource<SleepOverview>(() => ({
    url: `${API_BASE_URL}/children/sleep`,
    withCredentials: true,
  }));

  start(payload: { kind: SleepKind; startedAt?: string; notes?: string | null }) {
    return this.api
      .post<{ session: SleepSession; resumed: boolean }>('/children/sleep/start', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  stop(payload: { endedAt?: string; notes?: string | null }) {
    return this.api
      .post<{ session: SleepSession }>('/children/sleep/stop', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  pause(payload: { startedAt?: string } = {}) {
    return this.api
      .post<{ session: SleepSession; alreadyPaused: boolean }>('/children/sleep/pause', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  resume(payload: { endedAt?: string } = {}) {
    return this.api
      .post<{ session: SleepSession }>('/children/sleep/resume', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  updatePause(id: string, payload: { startedAt?: string; endedAt?: string | null }) {
    return this.api
      .patch<{ session: SleepSession }>(`/children/sleep/pauses/${id}`, payload)
      .pipe(tap(() => this.overview.reload()));
  }

  createSavedPause(id: string, payload: { startedAt: string; endedAt: string }) {
    return this.api
      .post<{ session: SleepSession }>(`/children/sleep/${id}/pauses`, payload)
      .pipe(tap(() => this.overview.reload()));
  }

  create(payload: SleepPayload) {
    return this.api
      .post<{ session: SleepSession }>('/children/sleep', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  update(id: string, payload: Partial<SleepPayload>) {
    return this.api
      .patch<{ session: SleepSession }>(`/children/sleep/${id}`, payload)
      .pipe(tap(() => this.overview.reload()));
  }

  remove(id: string) {
    return this.api.delete<{ ok: boolean }>(`/children/sleep/${id}`).pipe(tap(() => this.overview.reload()));
  }

  saveProfile(payload: { napTarget: number | null }) {
    return this.api
      .patch<{ napTarget: number | null }>('/children/sleep/profile', payload)
      .pipe(tap(() => this.overview.reload()));
  }
}
