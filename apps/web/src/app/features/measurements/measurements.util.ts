import { EnrichedMeasurement, MeasurementItem } from './measurements.model';

export function formatWeight(kg: number | null | undefined): string {
  if (kg == null || !Number.isFinite(kg)) return '—';
  return `${kg.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} кг`;
}

export function formatHeight(cm: number | null | undefined): string {
  if (cm == null || !Number.isFinite(cm)) return '—';
  return `${cm.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} см`;
}

export function formatHead(cm: number | null | undefined): string {
  if (cm == null || !Number.isFinite(cm)) return '—';
  return `${cm.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} см`;
}

export function formatDelta(
  delta: number | null | undefined,
  unit: string,
): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  const sign = delta > 0 ? '+' : '';
  const formatted = delta.toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return `${sign}${formatted} ${unit}`;
}

export function formatWeightDelta(
  deltaGrams: number | null | undefined,
): string | null {
  if (deltaGrams == null || !Number.isFinite(deltaGrams)) return null;
  const sign = deltaGrams > 0 ? '+' : '';
  if (Math.abs(deltaGrams) >= 1000) {
    const kg = deltaGrams / 1000;
    return `${sign}${kg.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} кг`;
  }
  return `${sign}${Math.round(deltaGrams)} г`;
}

export function calculateAgeAtDate(
  birthDateStr: string | null | undefined,
  targetDateStr: string,
): string | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  const target = new Date(targetDateStr);
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(target.getTime())) return null;

  if (target < birth) return 'До народження';

  let years = target.getFullYear() - birth.getFullYear();
  let months = target.getMonth() - birth.getMonth();
  let days = target.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years > 0) {
    return months > 0 ? `${years} р. ${months} міс.` : `${years} р.`;
  }
  if (months > 0) {
    return days > 0 ? `${months} міс. ${days} дн.` : `${months} міс.`;
  }
  return `${days} дн.`;
}

export function enrichMeasurements(
  measurements: readonly MeasurementItem[],
  birthDate: string | null | undefined,
): readonly EnrichedMeasurement[] {
  // Sort chronologically ascending to compute deltas
  const chronological = [...measurements].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  );

  const enrichedMap = new Map<string, EnrichedMeasurement>();

  let prevWeight: { value: number; date: number } | null = null;
  let prevHeight: { value: number; date: number } | null = null;
  let prevHead: { value: number; date: number } | null = null;

  for (const item of chronological) {
    const currentDate = new Date(item.measuredAt).getTime();

    let weightDeltaGrams: number | null = null;
    if (item.weightKg != null) {
      if (prevWeight && currentDate >= prevWeight.date) {
        weightDeltaGrams = Math.round((item.weightKg - prevWeight.value) * 1000);
      }
      prevWeight = { value: item.weightKg, date: currentDate };
    }

    let heightDeltaCm: number | null = null;
    if (item.heightCm != null) {
      if (prevHeight && currentDate >= prevHeight.date) {
        heightDeltaCm = Math.round((item.heightCm - prevHeight.value) * 10) / 10;
      }
      prevHeight = { value: item.heightCm, date: currentDate };
    }

    let headDeltaCm: number | null = null;
    if (item.headCircumferenceCm != null) {
      if (prevHead && currentDate >= prevHead.date) {
        headDeltaCm =
          Math.round((item.headCircumferenceCm - prevHead.value) * 10) / 10;
      }
      prevHead = { value: item.headCircumferenceCm, date: currentDate };
    }

    const ageLabel = calculateAgeAtDate(birthDate, item.measuredAt);

    enrichedMap.set(item.id, {
      ...item,
      ageLabel,
      weightDeltaGrams,
      heightDeltaCm,
      headDeltaCm,
    });
  }

  // Return preserving the original order (newest first)
  return measurements.map((item) => {
    const enriched = enrichedMap.get(item.id);
    return (
      enriched ?? {
        ...item,
        ageLabel: calculateAgeAtDate(birthDate, item.measuredAt),
        weightDeltaGrams: null,
        heightDeltaCm: null,
        headDeltaCm: null,
      }
    );
  });
}
