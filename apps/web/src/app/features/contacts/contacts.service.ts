import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { API_BASE_URL } from '../../core/api.config';
import { ContactItem, ContactPayload } from './contacts.model';

@Injectable()
export class ContactsService {
  private readonly api = inject(ApiService);
  readonly contacts = httpResource<ContactItem[]>(
    () => ({ url: `${API_BASE_URL}/contacts`, withCredentials: true }),
    { defaultValue: [] },
  );

  create(payload: ContactPayload) {
    return this.api.post<ContactItem>('/contacts', payload).pipe(tap(() => this.contacts.reload()));
  }

  update(id: string, payload: ContactPayload) {
    return this.api.patch<ContactItem>(`/contacts/${id}`, payload).pipe(tap(() => this.contacts.reload()));
  }

  remove(id: string) {
    return this.api.delete<void>(`/contacts/${id}`).pipe(tap(() => this.contacts.reload()));
  }
}
