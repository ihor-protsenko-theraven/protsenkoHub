import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { HistoryPanel } from '../../shared/history-panel.component';
import { toLocalDateTime } from '../../shared/date-time.util';
import { CalendarEvent, CalendarEventForm, CalendarEventPayload, EventStatus } from './calendar.model';
import { eventStatusLabel, eventStatusNotice } from './calendar-status.util';
import { CalendarService } from './calendar.service';

const emptyForm = (): CalendarEventForm => ({ title: '', notes: '', startsAt: '', endsAt: '' });

@Component({
  selector: 'app-calendar-page',
  imports: [DatePipe, FormField, HistoryPanel, NgTemplateOutlet],
  providers: [CalendarService],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly route = inject(ActivatedRoute);
  readonly data = inject(CalendarService);
  readonly events = this.data.events;
  readonly availableEvents = computed(() => this.events.hasValue() ? this.events.value() : []);
  readonly statusLabel = eventStatusLabel;
  readonly search = signal('');
  private readonly matched = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('uk');
    return this.availableEvents().filter((event) =>
      !query || (event.title + ' ' + (event.notes ?? '')).toLocaleLowerCase('uk').includes(query),
    );
  });
  readonly emptyTitle = computed(() => {
    if (this.search().trim()) return 'Запланованих подій не знайдено';
    if (this.availableEvents().length) return 'Запланованих подій немає';
    return 'Календар порожній';
  });
  readonly openEvents = computed(() => this.matched().filter((event) => event.status !== 'DONE'));
  readonly historyEvents = computed(() =>
    this.matched()
      .filter((event) => event.status === 'DONE')
      .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime()),
  );
  readonly formOpen = signal(this.route.snapshot.queryParamMap.has('new'));
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
        this.error.set('Подію не збережено. Спробуйте ще раз.');
      },
    });
  }

  setStatus(event: CalendarEvent, status: EventStatus): void {
    this.busy.set(true);
    this.data.update(event.id, { status }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(eventStatusNotice(status));
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося змінити статус події.');
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
