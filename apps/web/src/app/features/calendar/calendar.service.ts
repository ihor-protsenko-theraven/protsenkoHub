import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { API_BASE_URL } from '../../core/configs/api.config';
import { CalendarEvent, CalendarEventPayload } from './calendar.model';

@Injectable()
export class CalendarService {
  private readonly api = inject(ApiService);
  readonly events = httpResource<CalendarEvent[]>(
    () => ({ url: `${API_BASE_URL}/events`, withCredentials: true }),
    { defaultValue: [] },
  );

  create(payload: CalendarEventPayload) {
    return this.api.post<CalendarEvent>('/events', payload).pipe(tap(() => this.events.reload()));
  }

  update(id: string, payload: CalendarEventPayload) {
    return this.api.patch<CalendarEvent>(`/events/${id}`, payload).pipe(tap(() => this.events.reload()));
  }

  remove(id: string) {
    return this.api.delete<void>(`/events/${id}`).pipe(tap(() => this.events.reload()));
  }
}
