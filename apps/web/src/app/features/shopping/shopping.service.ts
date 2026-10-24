import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { API_BASE_URL } from '../../core/configs/api.config';
import { ShoppingItem, ShoppingItemPayload, ShoppingList } from './shopping.model';

@Injectable()
export class ShoppingService {
  private readonly api = inject(ApiService);
  readonly items = httpResource<ShoppingItem[]>(
    () => ({ url: `${API_BASE_URL}/shopping/items`, withCredentials: true }),
    { defaultValue: [] },
  );
  readonly lists = httpResource<ShoppingList[]>(
    () => ({ url: `${API_BASE_URL}/shopping/lists`, withCredentials: true }),
    { defaultValue: [] },
  );

  createList(payload: { name: string; items: string[] }) {
    return this.api.post<ShoppingList>('/shopping/lists', payload).pipe(tap(() => {
      this.lists.reload();
      this.items.reload();
    }));
  }

  removeList(id: string) {
    return this.api.delete<void>(`/shopping/lists/${id}`).pipe(tap(() => {
      this.lists.reload();
      this.items.reload();
    }));
  }

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
