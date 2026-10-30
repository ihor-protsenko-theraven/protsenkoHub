export const SHOPPING_CONFIG = {
  historyDays: 21,
  dayMs: 86_400_000,
} as const;

export function isWithinHistory(dateString: string | undefined, now: number = Date.now()): boolean {
  if (!dateString) return true;
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return true;
  return now - timestamp <= SHOPPING_CONFIG.historyDays * SHOPPING_CONFIG.dayMs;
}
