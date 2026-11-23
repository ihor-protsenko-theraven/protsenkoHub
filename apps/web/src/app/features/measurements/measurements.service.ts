import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../../core/configs/api.config';
import { ApiService } from '../../core/services/api.service';
import {
  MeasurementItem,
  MeasurementPayload,
  MeasurementsFeed,
} from './measurements.model';

@Injectable()
export class MeasurementsService {
  private readonly api = inject(ApiService);

  readonly feed = httpResource<MeasurementsFeed>(
    () => ({
      url: `${API_BASE_URL}/children/measurements`,
      withCredentials: true,
    }),
    { defaultValue: { child: null, measurements: [] } },
  );

  create(payload: MeasurementPayload) {
    return this.api
      .post<MeasurementItem>('/children/measurements', payload)
      .pipe(
        tap((created) =>
          this.feed.update((current) => ({
            ...current,
            measurements: [...current.measurements, created].sort(
              (a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt),
            ),
          })),
        ),
      );
  }

  update(id: string, payload: Partial<MeasurementPayload>) {
    return this.api
      .patch<MeasurementItem>(`/children/measurements/${id}`, payload)
      .pipe(
        tap((updated) =>
          this.feed.update((current) => ({
            ...current,
            measurements: current.measurements
              .map((entry) => (entry.id === updated.id ? updated : entry))
              .sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt)),
          })),
        ),
      );
  }

  remove(id: string) {
    return this.api
      .delete<void>(`/children/measurements/${id}`)
      .pipe(
        tap(() =>
          this.feed.update((current) => ({
            ...current,
            measurements: current.measurements.filter((entry) => entry.id !== id),
          })),
        ),
      );
  }
}
