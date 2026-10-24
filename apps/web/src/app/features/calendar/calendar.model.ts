import type { RecordAudit } from '../../shared/record-audit.model';

export type EventStatus = 'OPEN' | 'DONE';

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
