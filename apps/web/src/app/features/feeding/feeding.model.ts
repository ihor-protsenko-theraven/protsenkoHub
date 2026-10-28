export type FeedingStatus = 'PENDING' | 'INTRODUCED' | 'ALLERGY' | 'REFUSED';

export interface FoodItem {
  id: string;
  categoryId: string;
  name: string;
  allowedFromAgeMonths: number;
  preparationGuide: string;
  isAllergen: boolean;
}

export interface FoodCategoryGroup {
  id: string;
  name: string;
  items: FoodItem[];
}

export interface FeedingChild {
  id: string;
  name: string;
  birthDate: string | null;
  ageMonths: number | null;
}

export interface FeedingRecord {
  id: string;
  childId: string;
  foodItemId: string;
  status: FeedingStatus;
  notes: string | null;
  updatedAt: string;
}

export interface FeedingTracker {
  child: FeedingChild | null;
  records: FeedingRecord[];
}

export interface FeedingFocusFood {
  id: string;
  name: string;
  categoryName: string;
  allowedFromAgeMonths: number;
  isAllergen: boolean;
  preparationGuide: string;
}

export interface FeedingFocus {
  child: FeedingChild | null;
  current: FeedingFocusFood | null;
  next: FeedingFocusFood | null;
}

export interface FeedingRecordPayload {
  status: FeedingStatus;
  notes: string | null;
}

export interface FeedingDraft {
  status: FeedingStatus;
  notes: string;
}
