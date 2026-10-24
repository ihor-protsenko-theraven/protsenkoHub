import type { SleepKind } from './sleep.model';

export function sleepKindLabel(kind: SleepKind): string {
  switch (kind) {
    case 'NAP':
      return 'Денний сон';
    case 'NIGHT':
      return 'Ніч';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
