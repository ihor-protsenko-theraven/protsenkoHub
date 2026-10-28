export function formatAgeMonths(months: number): string {
  return `${wholeMonths(months)} ${ageWord(wholeMonths(months), 'місяць', 'місяці', 'місяців')}`;
}

export function formatAllowedFrom(months: number): string {
  const value = wholeMonths(months);
  const word = value % 10 === 1 && value % 100 !== 11 ? 'місяця' : 'місяців';
  return `з ${value} ${word}`;
}

function wholeMonths(months: number): number {
  return Math.max(0, Math.trunc(months));
}

function ageWord(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
