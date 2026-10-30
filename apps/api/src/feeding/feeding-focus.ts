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
  updatedAt?: string | Date;
}

interface OrderedPlanItem {
  readonly id: string;
  readonly name: string;
  readonly categoryName: string;
  readonly categorySort: number;
  readonly sortOrder: number;
  readonly allowedFromAgeMonths: number;
  readonly isAllergen: boolean;
  readonly preparationGuide: string;
  readonly planIndex: number;
}

export function pickFeedingFocus(
  categories: readonly FeedingPlanCategory[],
  records: readonly FeedingPlanRecord[],
  ageMonths: number | null,
): {
  introduced: FeedingFocusFoodDto | null;
  current: FeedingFocusFoodDto | null;
  next: FeedingFocusFoodDto | null;
} {
  const recordByFood = new Map(
    records.map((record) => [record.foodItemId, record]),
  );

  const sortedPlan: OrderedPlanItem[] = categories
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
        planIndex: 0,
      })),
    )
    .sort(
      (left, right) =>
        left.allowedFromAgeMonths - right.allowedFromAgeMonths ||
        left.categorySort - right.categorySort ||
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, 'uk'),
    )
    .map((item, planIndex) => ({ ...item, planIndex }));

  const introducedCandidates = sortedPlan
    .filter((item) => recordByFood.get(item.id)?.status === 'INTRODUCED')
    .sort((left, right) => {
      const leftTime = toTimestamp(recordByFood.get(left.id)?.updatedAt);
      const rightTime = toTimestamp(recordByFood.get(right.id)?.updatedAt);
      if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return right.planIndex - left.planIndex;
    });

  const latestIntroduced = introducedCandidates[0] ?? null;
  const introduced = latestIntroduced ? toFocusDto(latestIntroduced) : null;

  const openItems = sortedPlan.filter((item) =>
    isOpen(recordByFood.get(item.id)?.status),
  );

  const orderedOpen = latestIntroduced
    ? reorderAfterIntroduced(
        openItems,
        latestIntroduced.planIndex,
        recordByFood,
      )
    : openItems.map(toFocusDto);

  if (ageMonths === null) {
    if (introduced) {
      const nextOpen = orderedOpen[0] ?? null;
      return { introduced, current: nextOpen, next: nextOpen };
    }
    return {
      introduced: null,
      current: orderedOpen[0] ?? null,
      next: orderedOpen[1] ?? null,
    };
  }

  const ready = orderedOpen.filter(
    (food) => food.allowedFromAgeMonths <= ageMonths,
  );
  const later = orderedOpen.filter(
    (food) => food.allowedFromAgeMonths > ageMonths,
  );

  if (introduced) {
    return {
      introduced,
      current: ready[0] ?? null,
      next: ready[0] ?? later[0] ?? null,
    };
  }

  return {
    introduced: null,
    current: ready[0] ?? null,
    next: ready[1] ?? later[0] ?? null,
  };
}

function reorderAfterIntroduced(
  openItems: readonly OrderedPlanItem[],
  introducedPlanIndex: number,
  recordByFood: ReadonlyMap<string, FeedingPlanRecord>,
): FeedingFocusFoodDto[] {
  const pending = openItems.filter(
    (item) => recordByFood.get(item.id)?.status === 'PENDING',
  );
  const after = openItems.filter(
    (item) =>
      recordByFood.get(item.id)?.status !== 'PENDING' &&
      item.planIndex > introducedPlanIndex,
  );
  const before = openItems.filter(
    (item) =>
      recordByFood.get(item.id)?.status !== 'PENDING' &&
      item.planIndex < introducedPlanIndex,
  );
  return [...pending, ...after, ...before].map(toFocusDto);
}

function toFocusDto(item: OrderedPlanItem): FeedingFocusFoodDto {
  return {
    id: item.id,
    name: item.name,
    categoryName: item.categoryName,
    allowedFromAgeMonths: item.allowedFromAgeMonths,
    isAllergen: item.isAllergen,
    preparationGuide: item.preparationGuide,
  };
}

function toTimestamp(value: string | Date | undefined): number | null {
  if (!value) return null;
  const time =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isOpen(status: FeedingStatus | undefined): boolean {
  return status === undefined || status === 'PENDING';
}
