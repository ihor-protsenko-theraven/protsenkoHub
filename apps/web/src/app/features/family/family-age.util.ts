import { FAMILY_AGE } from './family.config';

export function formatAgeFromBirthDate(birthDate: string, now = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FAMILY_AGE.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const today = Date.UTC(part('year'), part('month') - 1, part('day'));
  const days = Math.round((today - birth.getTime()) / FAMILY_AGE.dayMs);
  if (days < 0) return null;
  const months = Math.floor(days / FAMILY_AGE.daysPerMonth);
  const extraDays = Math.max(0, Math.round(days - months * FAMILY_AGE.daysPerMonth));
  if (months <= 0) return `${days} дн.`;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths === 0 ? `${years} р.` : `${years} р. ${remMonths} міс.`;
  }
  if (extraDays === 0) return `${months} міс.`;
  return `${months} міс. ${extraDays} дн.`;
}
