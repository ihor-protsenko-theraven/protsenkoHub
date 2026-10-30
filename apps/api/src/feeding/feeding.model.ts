import type { FeedingStatus } from '@prisma/client';

export interface FeedingDictionaryItem {
  id: string;
  name: string;
  allowedFromAgeMonths: number;
  preparationGuide: string;
  isAllergen: boolean;
  sortOrder: number;
}

export interface FeedingDictionaryCategory {
  id: string;
  name: string;
  sortOrder: number;
  items: readonly FeedingDictionaryItem[];
}

export interface FoodItemDto {
  id: string;
  categoryId: string;
  name: string;
  allowedFromAgeMonths: number;
  preparationGuide: string;
  isAllergen: boolean;
}

export interface FoodCategoryDto {
  id: string;
  name: string;
  items: FoodItemDto[];
}

export interface FeedingChildDto {
  id: string;
  name: string;
  birthDate: string | null;
  ageMonths: number | null;
}

export interface FeedingRecordDto {
  id: string;
  childId: string;
  foodItemId: string;
  status: FeedingStatus;
  notes: string | null;
  updatedAt: string;
}

export interface FeedingTrackerDto {
  child: FeedingChildDto | null;
  records: FeedingRecordDto[];
}

export interface FeedingFocusFoodDto {
  id: string;
  name: string;
  categoryName: string;
  allowedFromAgeMonths: number;
  isAllergen: boolean;
  preparationGuide: string;
}

export interface FeedingFocusDto {
  child: FeedingChildDto | null;
  introduced: FeedingFocusFoodDto | null;
  current: FeedingFocusFoodDto | null;
  next: FeedingFocusFoodDto | null;
}
