import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../../core/configs/api.config';
import { ApiService } from '../../core/services/api.service';
import type { FeedingRecord } from '../feeding/feeding.model';
import type { ShoppingItem } from '../shopping/shopping.model';
import type { SleepKind, SleepSession } from '../sleep/sleep.model';
import { HomeSnapshot } from './home.model';

@Injectable()
export class HomeService {
  private readonly api = inject(ApiService);

  readonly snapshot = httpResource<HomeSnapshot>(() => ({
    url: `${API_BASE_URL}/home`,
    withCredentials: true,
  }));

  markFoodIntroduced(foodItemId: string) {
    return this.api
      .put<FeedingRecord>(`/feeding/records/${foodItemId}`, {
        status: 'INTRODUCED',
      })
      .pipe(tap(() => this.snapshot.reload()));
  }

  addShoppingItem(name: string) {
    return this.api
      .post<ShoppingItem>('/shopping/items', { name, qty: 1 })
      .pipe(tap(() => this.snapshot.reload()));
  }

  toggleShoppingItem(item: ShoppingItem) {
    return this.api
      .patch<ShoppingItem>(`/shopping/items/${item.id}`, {
        isChecked: !item.isChecked,
        version: item.version,
      })
      .pipe(tap(() => this.snapshot.reload()));
  }

  startSleep(kind: SleepKind) {
    return this.api
      .post<{ session: SleepSession; resumed: boolean }>('/children/sleep/start', { kind })
      .pipe(tap(() => this.snapshot.reload()));
  }

  pauseSleep() {
    return this.api
      .post<{ session: SleepSession; alreadyPaused: boolean }>('/children/sleep/pause', {})
      .pipe(tap(() => this.snapshot.reload()));
  }

  resumeSleep() {
    return this.api
      .post<{ session: SleepSession }>('/children/sleep/resume', {})
      .pipe(tap(() => this.snapshot.reload()));
  }

  stopSleep() {
    return this.api
      .post<{ session: SleepSession }>('/children/sleep/stop', {})
      .pipe(tap(() => this.snapshot.reload()));
  }
}
