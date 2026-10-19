import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { toLocalDateTime } from '../../shared/date-time.util';
import { CalendarEvent, CalendarEventForm, CalendarEventPayload } from './calendar.model';
import { CalendarService } from './calendar.service';

const emptyForm = (): CalendarEventForm => ({ title: '', notes: '', startsAt: '', endsAt: '' });

@Component({
  selector: 'app-calendar-page',
  imports: [DatePipe, FormField],
  providers: [CalendarService],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  readonly data = inject(CalendarService);
  readonly events = this.data.events;
  readonly search = signal('');
  readonly period = signal<'all' | 'upcoming' | 'past'>('upcoming');
  readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('uk');
    const now = Date.now();
    return this.events.value().filter((event) => {
      const matchesText = !query || (event.title + ' ' + (event.notes ?? '')).toLocaleLowerCase('uk').includes(query);
      const matchesPeriod = this.period() === 'all' ||
        (this.period() === 'upcoming' ? new Date(event.endsAt).getTime() >= now : new Date(event.endsAt).getTime() < now);
      return matchesText && matchesPeriod;
    });
  });
  readonly formOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly model = signal<CalendarEventForm>(emptyForm());
  readonly eventForm = form(this.model, (path) => {
    required(path.title);
    required(path.startsAt);
    required(path.endsAt);
  });

  createNew(): void {
    this.editingId.set(null);
    this.model.set(emptyForm());
    this.error.set('');
    this.formOpen.set(true);
  }

  edit(event: CalendarEvent): void {
    this.editingId.set(event.id);
    this.model.set({
      title: event.title,
      notes: event.notes ?? '',
      startsAt: toLocalDateTime(event.startsAt),
      endsAt: toLocalDateTime(event.endsAt),
    });
    this.error.set('');
    this.formOpen.set(true);
  }

  cancel(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.error.set('');
  }

  save(): void {
    const value = this.model();
    const start = new Date(value.startsAt);
    const end = new Date(value.endsAt);
    if (!value.title.trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      this.error.set('Вкажіть назву та час завершення пізніше за початок.');
      return;
    }
    const payload: CalendarEventPayload = {
      title: value.title.trim(),
      notes: value.notes.trim(),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    };
    this.busy.set(true);
    const id = this.editingId();
    const request = id ? this.data.update(id, payload) : this.data.create(payload);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(id ? 'Подію оновлено.' : 'Подію додано.');
        this.cancel();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося зберегти подію. Спробуйте ще раз.');
      },
    });
  }

  remove(id: string): void {
    this.busy.set(true);
    this.data.remove(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deletingId.set(null);
        this.notice.set('Подію видалено.');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося видалити подію.');
      },
    });
  }
}
