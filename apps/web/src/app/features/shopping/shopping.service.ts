import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
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
    return this.api
      .post<ShoppingList & { items?: ShoppingItem[] }>('/shopping/lists', payload)
      .pipe(
        tap((created) => {
          const { items: createdItems, ...list } = created;
          this.lists.update((all) => [list, ...all]);
          if (createdItems?.length) {
            this.items.update((all) => [...all, ...createdItems]);
          } else {
            this.items.reload();
          }
        }),
      );
  }

  removeList(id: string) {
    return this.api.delete<void>(`/shopping/lists/${id}`).pipe(
      tap(() => {
        this.lists.update((all) => all.filter((list) => list.id !== id));
        this.items.update((all) => all.filter((item) => item.listId !== id));
      }),
    );
  }

  create(payload: ShoppingItemPayload) {
    return this.api.post<ShoppingItem>('/shopping/items', payload).pipe(
      tap((created) => this.items.update((list) => [...list, created])),
    );
  }

  update(id: string, payload: Partial<ShoppingItemPayload> & { isChecked?: boolean; version: number }) {
    return this.api.patch<ShoppingItem>(`/shopping/items/${id}`, payload).pipe(
      tap((updated) =>
        this.items.update((list) =>
          list.map((entry) => (entry.id === updated.id ? updated : entry)),
        ),
      ),
    );
  }

  toggle(item: ShoppingItem) {
    const isChecked = !item.isChecked;
    const updatedAt = new Date().toISOString();
    this.items.update((list) =>
      list.map((entry) => (entry.id === item.id ? { ...entry, isChecked, updatedAt } : entry)),
    );
    return this.update(item.id, { isChecked, version: item.version }).pipe(
      catchError((error: unknown) => {
        this.items.reload();
        return throwError(() => error);
      }),
    );
  }

  remove(id: string) {
    return this.api.delete<void>(`/shopping/items/${id}`).pipe(
      tap(() => this.items.update((list) => list.filter((entry) => entry.id !== id))),
    );
  }
}
