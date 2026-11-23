import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { API_BASE_URL } from '../../core/configs/api.config';
import { ContactItem, ContactPayload } from './contacts.model';

@Injectable()
export class ContactsService {
  private readonly api = inject(ApiService);
  readonly contacts = httpResource<ContactItem[]>(
    () => ({ url: `${API_BASE_URL}/contacts`, withCredentials: true }),
    { defaultValue: [] },
  );

  create(payload: ContactPayload) {
    return this.api.post<ContactItem>('/contacts', payload).pipe(
      tap((created) => this.contacts.update((list) => [...list, created])),
    );
  }

  update(id: string, payload: ContactPayload) {
    return this.api.patch<ContactItem>(`/contacts/${id}`, payload).pipe(
      tap((updated) =>
        this.contacts.update((list) =>
          list.map((entry) => (entry.id === updated.id ? updated : entry)),
        ),
      ),
    );
  }

  remove(id: string) {
    return this.api.delete<void>(`/contacts/${id}`).pipe(
      tap(() => this.contacts.update((list) => list.filter((entry) => entry.id !== id))),
    );
  }
}
