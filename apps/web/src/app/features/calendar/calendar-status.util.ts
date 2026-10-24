import type { EventStatus } from './calendar.model';

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
