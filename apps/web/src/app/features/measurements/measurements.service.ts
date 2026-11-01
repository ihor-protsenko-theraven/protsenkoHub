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
      .pipe(tap(() => this.feed.reload()));
  }

  update(id: string, payload: Partial<MeasurementPayload>) {
    return this.api
      .patch<MeasurementItem>(`/children/measurements/${id}`, payload)
      .pipe(tap(() => this.feed.reload()));
  }

  remove(id: string) {
    return this.api
      .delete<void>(`/children/measurements/${id}`)
      .pipe(tap(() => this.feed.reload()));
  }
}
