import type { TaskPriority, TaskStatus } from './children.model';

export const TASK_PRIORITIES: ReadonlyArray<{ value: TaskPriority; label: string }> = [
  { value: 1, label: 'Звичайний' },
  { value: 2, label: 'Важливо' },
  { value: 3, label: 'Терміново' },
];

export const TASK_STATUSES: ReadonlyArray<{ value: TaskStatus; label: string }> = [
  { value: 'TODO', label: 'Очікує' },
  { value: 'IN_PROGRESS', label: 'У процесі' },
  { value: 'DONE', label: 'Готово' },
];
