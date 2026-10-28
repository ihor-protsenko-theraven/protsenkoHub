import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../../core/configs/api.config';
import { ApiService } from '../../core/services/api.service';
import {
  FeedingRecord,
  FeedingRecordPayload,
  FeedingTracker,
  FoodCategoryGroup,
} from './feeding.model';

@Injectable()
export class FeedingService {
  private readonly api = inject(ApiService);
  readonly dictionary = httpResource<FoodCategoryGroup[]>(
    () => ({ url: `${API_BASE_URL}/feeding/dictionary`, withCredentials: true }),
    { defaultValue: [] },
  );
  readonly records = httpResource<FeedingTracker>(
    () => ({ url: `${API_BASE_URL}/feeding/records`, withCredentials: true }),
  );

  upsert(foodItemId: string, payload: FeedingRecordPayload) {
    return this.api.put<FeedingRecord>(`/feeding/records/${foodItemId}`, payload).pipe(
      tap(() => this.records.reload()),
    );
  }
}
