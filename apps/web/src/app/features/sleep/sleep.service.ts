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
    url: `${API_BASE_URL}/solomiya/sleep`,
    withCredentials: true,
  }));

  start(payload: { kind: SleepKind; startedAt?: string; notes?: string | null }) {
    return this.api
      .post<{ session: SleepSession; resumed: boolean }>('/solomiya/sleep/start', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  stop(payload: { endedAt?: string; notes?: string | null }) {
    return this.api
      .post<{ session: SleepSession }>('/solomiya/sleep/stop', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  pause(payload: { startedAt?: string } = {}) {
    return this.api
      .post<{ session: SleepSession; alreadyPaused: boolean }>('/solomiya/sleep/pause', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  resume(payload: { endedAt?: string } = {}) {
    return this.api
      .post<{ session: SleepSession }>('/solomiya/sleep/resume', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  updatePause(id: string, payload: { startedAt?: string; endedAt?: string | null }) {
    return this.api
      .patch<{ session: SleepSession }>(`/solomiya/sleep/pauses/${id}`, payload)
      .pipe(tap(() => this.overview.reload()));
  }

  createSavedPause(id: string, payload: { startedAt: string; endedAt: string }) {
    return this.api
      .post<{ session: SleepSession }>(`/solomiya/sleep/${id}/pauses`, payload)
      .pipe(tap(() => this.overview.reload()));
  }

  create(payload: SleepPayload) {
    return this.api
      .post<{ session: SleepSession }>('/solomiya/sleep', payload)
      .pipe(tap(() => this.overview.reload()));
  }

  update(id: string, payload: Partial<SleepPayload>) {
    return this.api
      .patch<{ session: SleepSession }>(`/solomiya/sleep/${id}`, payload)
      .pipe(tap(() => this.overview.reload()));
  }

  remove(id: string) {
    return this.api.delete<{ ok: boolean }>(`/solomiya/sleep/${id}`).pipe(tap(() => this.overview.reload()));
  }

  saveProfile(payload: { birthDate?: string | null; napTarget?: number | null }) {
    return this.api
      .patch<{ birthDate: string | null; napTarget: number | null }>('/solomiya/sleep/profile', payload)
      .pipe(tap(() => this.overview.reload()));
  }
}
