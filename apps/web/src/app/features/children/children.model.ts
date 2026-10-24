import type { RecordAudit } from '../../shared/record-audit.model';

export type TaskPriority = 1 | 2 | 3;

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface TaskItem extends RecordAudit {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  status: TaskStatus;
  priority: number;
}

export interface TaskForm {
  title: string;
  notes: string;
  dueAt: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface TaskPayload {
  title: string;
  notes?: string | null;
  dueAt?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
}
