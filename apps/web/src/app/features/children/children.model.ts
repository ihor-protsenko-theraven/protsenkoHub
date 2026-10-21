import type { RecordAudit } from '../../shared/record-audit.model';

export type TaskPriority = 1 | 2 | 3;

export const TASK_PRIORITIES: ReadonlyArray<{ value: TaskPriority; label: string }> = [
  { value: 1, label: 'Звичайний' },
  { value: 2, label: 'Важливо' },
  { value: 3, label: 'Терміново' },
];

export function normalizePriority(value: number): TaskPriority {
  if (value >= 3) return 3;
  if (value === 2) return 2;
  return 1;
}

export function taskPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 1:
      return 'Звичайний';
    case 2:
      return 'Важливо';
    case 3:
      return 'Терміново';
    default: {
      const exhaustive: never = priority;
      return exhaustive;
    }
  }
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export const TASK_STATUSES: ReadonlyArray<{ value: TaskStatus; label: string }> = [
  { value: 'TODO', label: 'Очікує' },
  { value: 'IN_PROGRESS', label: 'У процесі' },
  { value: 'DONE', label: 'Готово' },
];

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUSES.find((option) => option.value === status)?.label ?? status;
}

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
