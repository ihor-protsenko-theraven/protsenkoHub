import { httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { API_BASE_URL } from '../../core/configs/api.config';
import { CalendarEvent, CalendarEventPayload, CalendarEventUpdatePayload } from './calendar.model';

@Injectable()
export class CalendarService {
  private readonly api = inject(ApiService);
  readonly events = httpResource<CalendarEvent[]>(
    () => ({ url: `${API_BASE_URL}/events`, withCredentials: true }),
    { defaultValue: [] },
  );

  create(payload: CalendarEventPayload) {
    return this.api.post<CalendarEvent>('/events', payload).pipe(
      tap((created) =>
        this.events.update((list) =>
          [...list, created].sort(
            (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
          ),
        ),
      ),
    );
  }

  update(id: string, payload: CalendarEventUpdatePayload) {
    return this.api.patch<CalendarEvent>(`/events/${id}`, payload).pipe(
      tap((updated) =>
        this.events.update((list) =>
          list
            .map((entry) => (entry.id === updated.id ? updated : entry))
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
        ),
      ),
    );
  }

  remove(id: string) {
    return this.api.delete<void>(`/events/${id}`).pipe(
      tap(() => this.events.update((list) => list.filter((entry) => entry.id !== id))),
    );
  }
}
