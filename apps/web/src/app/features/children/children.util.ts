import type { TaskPriority } from './children.model';

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
