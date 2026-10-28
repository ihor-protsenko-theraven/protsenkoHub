import type { FeedingStatus } from '@prisma/client';
import type { FeedingFocusFoodDto } from './feeding.model';

export interface FeedingPlanCategory {
  name: string;
  sortOrder: number;
  items: readonly FeedingPlanItem[];
}

export interface FeedingPlanItem {
  id: string;
  name: string;
  sortOrder: number;
  allowedFromAgeMonths: number;
  isAllergen: boolean;
  preparationGuide: string;
}

export interface FeedingPlanRecord {
  foodItemId: string;
  status: FeedingStatus;
}

export function pickFeedingFocus(
  categories: readonly FeedingPlanCategory[],
  records: readonly FeedingPlanRecord[],
  ageMonths: number | null,
): { current: FeedingFocusFoodDto | null; next: FeedingFocusFoodDto | null } {
  const statusByFood = new Map(
    records.map((record) => [record.foodItemId, record.status]),
  );
  const open = categories
    .flatMap((category) =>
      category.items.map((item) => ({
        id: item.id,
        name: item.name,
        categoryName: category.name,
        categorySort: category.sortOrder,
        sortOrder: item.sortOrder,
        allowedFromAgeMonths: item.allowedFromAgeMonths,
        isAllergen: item.isAllergen,
        preparationGuide: item.preparationGuide,
      })),
    )
    .filter((item) => isOpen(statusByFood.get(item.id)))
    .sort(
      (left, right) =>
        left.allowedFromAgeMonths - right.allowedFromAgeMonths ||
        left.categorySort - right.categorySort ||
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, 'uk'),
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      categoryName: item.categoryName,
      allowedFromAgeMonths: item.allowedFromAgeMonths,
      isAllergen: item.isAllergen,
      preparationGuide: item.preparationGuide,
    }));

  if (ageMonths === null) {
    return { current: open[0] ?? null, next: open[1] ?? null };
  }

  const ready = open.filter((food) => food.allowedFromAgeMonths <= ageMonths);
  const later = open.filter((food) => food.allowedFromAgeMonths > ageMonths);
  return {
    current: ready[0] ?? null,
    next: ready[1] ?? later[0] ?? null,
  };
}

function isOpen(status: FeedingStatus | undefined): boolean {
  return status === undefined || status === 'PENDING';
}
