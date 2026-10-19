import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { API_BASE_URL } from '../../core/api.config';
import { ShoppingItem, ShoppingItemPayload } from './shopping.model';

@Injectable()
export class ShoppingService {
  private readonly api = inject(ApiService);
  readonly items = httpResource<ShoppingItem[]>(
    () => ({ url: `${API_BASE_URL}/shopping/items`, withCredentials: true }),
    { defaultValue: [] },
  );

  create(payload: ShoppingItemPayload) {
    return this.api.post<ShoppingItem>('/shopping/items', payload).pipe(tap(() => this.items.reload()));
  }

  update(id: string, payload: Partial<ShoppingItemPayload> & { isChecked?: boolean; version: number }) {
    return this.api.patch<ShoppingItem>(`/shopping/items/${id}`, payload).pipe(tap(() => this.items.reload()));
  }

  remove(id: string) {
    return this.api.delete<void>(`/shopping/items/${id}`).pipe(tap(() => this.items.reload()));
  }
}
