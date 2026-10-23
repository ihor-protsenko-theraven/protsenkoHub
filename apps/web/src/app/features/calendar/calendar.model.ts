import type { RecordAudit } from '../../shared/record-audit.model';

export type EventStatus = 'OPEN' | 'DONE';

export function eventStatusLabel(status: EventStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Заплановано';
    case 'DONE':
      return 'Завершено';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function eventStatusNotice(status: EventStatus): string {
  switch (status) {
    case 'DONE':
      return 'Подію завершено. Вона в історії.';
    case 'OPEN':
      return 'Подію повернуто до календаря.';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export interface CalendarEvent extends RecordAudit {
  id: string;
  title: string;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  member?: { color: string; displayName: string } | null;
}

export interface CalendarEventForm {
  title: string;
  notes: string;
  startsAt: string;
  endsAt: string;
}

export interface CalendarEventPayload {
  title: string;
  notes: string;
  startsAt: string;
  endsAt: string;
}

export type CalendarEventUpdatePayload = Partial<CalendarEventPayload> & { status?: EventStatus };
