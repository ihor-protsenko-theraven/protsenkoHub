import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { RouterLink } from '@angular/router';
import { Loader } from '../../shared/loader.component';
import {
  FEEDING,
  FEEDING_STATUS_LABELS,
  FEEDING_STATUSES,
  FEEDING_TABS,
  FEEDING_TIPS,
  FeedingTab,
} from './feeding.config';
import { formatAgeMonths, formatAllowedFrom } from './feeding-age.util';
import { feedingGuideSteps } from './feeding-guide.util';
import { FeedingTrackerCard } from './feeding-tracker-card.component';
import { FeedingService } from './feeding.service';
import {
  FeedingProgressSummary,
  FeedingRecord,
  FeedingStatus,
  FoodItem,
  GuideCategoryGroup,
} from './feeding.model';

@Component({
  selector: 'app-feeding-page',
  imports: [Tabs, TabList, Tab, TabPanel, TabContent, RouterLink, Loader, FeedingTrackerCard],
  providers: [FeedingService],
  templateUrl: './feeding.page.html',
  styleUrl: './feeding.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedingPage {
  private readonly data = inject(FeedingService);
  readonly dictionary = this.data.dictionary;
  readonly records = this.data.records;
  readonly tabs = FEEDING_TABS;
  readonly statuses = FEEDING_STATUSES;
  readonly disclaimer = FEEDING.disclaimer;
  readonly tips = FEEDING_TIPS;
  readonly guideSteps = feedingGuideSteps;
  readonly formatAgeMonths = formatAgeMonths;
  readonly allowedFrom = formatAllowedFrom;
  readonly tab = signal<FeedingTab>('guide');
  readonly guideQuery = signal('');
  readonly categoryId = signal('ALL');
  readonly ageOnly = signal(false);
  readonly hideIntroduced = signal(false);
  readonly trackerQuery = signal('');
  readonly trackerStatus = signal<FeedingStatus | 'ALL'>('ALL');
  readonly savingFoodId = signal<string | null>(null);
  readonly quickError = signal('');
  readonly loading = computed(() => this.dictionary.status() === 'loading' || this.records.status() === 'loading');
  readonly failed = computed(() => this.dictionary.status() === 'error' || this.records.status() === 'error');
  readonly categories = computed(() => this.dictionary.hasValue() ? this.dictionary.value() : []);
  readonly tracker = computed(() => this.records.hasValue() ? this.records.value() : null);
  readonly child = computed(() => this.tracker()?.child ?? null);
  readonly ageMonths = computed(() => this.child()?.ageMonths ?? null);
  readonly recordMap = computed(() => {
    const entries = (this.tracker()?.records ?? []).map((record): readonly [string, FeedingRecord] => [
      record.foodItemId,
      record,
    ]);
    return new Map<string, FeedingRecord>(entries);
  });
  readonly progress = computed<FeedingProgressSummary>(() => {
    const byFood = this.recordMap();
    let total = 0;
    let introduced = 0;
    let allergy = 0;
    let refused = 0;
    for (const category of this.categories()) {
      for (const item of category.items) {
        total += 1;
        const status = byFood.get(item.id)?.status ?? 'PENDING';
        if (status === 'INTRODUCED') introduced += 1;
        else if (status === 'ALLERGY') allergy += 1;
        else if (status === 'REFUSED') refused += 1;
      }
    }
    return {
      total,
      introduced,
      allergy,
      refused,
      pending: Math.max(0, total - introduced - allergy - refused),
    };
  });
  readonly focusPair = computed(() => {
    const byFood = this.recordMap();
    const age = this.ageMonths();
    const ordered = this.categories()
      .flatMap((category, categorySort) =>
        category.items.map((item, itemSort) => ({
          item,
          categoryName: category.name,
          categorySort,
          itemSort,
          planIndex: 0,
        })),
      )
      .sort(
        (left, right) =>
          left.item.allowedFromAgeMonths - right.item.allowedFromAgeMonths ||
          left.categorySort - right.categorySort ||
          left.itemSort - right.itemSort ||
          left.item.name.localeCompare(right.item.name, 'uk'),
      )
      .map((entry, planIndex) => ({ ...entry, planIndex }));

    const introducedList = ordered
      .filter((entry) => byFood.get(entry.item.id)?.status === 'INTRODUCED')
      .sort((left, right) => {
        const leftTime = Date.parse(byFood.get(left.item.id)?.updatedAt ?? '');
        const rightTime = Date.parse(byFood.get(right.item.id)?.updatedAt ?? '');
        if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
          return rightTime - leftTime;
        }
        return right.planIndex - left.planIndex;
      });

    const introduced = introducedList[0] ?? null;
    const open = ordered.filter((entry) => {
      const status = byFood.get(entry.item.id)?.status;
      return status === undefined || status === 'PENDING';
    });
    const orderedOpen = introduced
      ? [
          ...open.filter((entry) => byFood.get(entry.item.id)?.status === 'PENDING'),
          ...open.filter(
            (entry) =>
              byFood.get(entry.item.id)?.status !== 'PENDING' &&
              entry.planIndex > introduced.planIndex,
          ),
          ...open.filter(
            (entry) =>
              byFood.get(entry.item.id)?.status !== 'PENDING' &&
              entry.planIndex < introduced.planIndex,
          ),
        ]
      : open;

    if (age === null) {
      return {
        introduced,
        current: orderedOpen[0] ?? null,
        next: introduced ? (orderedOpen[0] ?? null) : (orderedOpen[1] ?? null),
      };
    }

    const ready = orderedOpen.filter((entry) => entry.item.allowedFromAgeMonths <= age);
    const later = orderedOpen.filter((entry) => entry.item.allowedFromAgeMonths > age);
    return {
      introduced,
      current: ready[0] ?? null,
      next: introduced ? (ready[0] ?? later[0] ?? null) : (ready[1] ?? later[0] ?? null),
    };
  });
  readonly hasActiveGuideFilters = computed(
    () =>
      this.guideQuery().trim().length > 0 ||
      this.categoryId() !== 'ALL' ||
      this.ageOnly() ||
      this.hideIntroduced(),
  );
  readonly guideCategories = computed<GuideCategoryGroup[]>(() => {
    const query = this.guideQuery().trim().toLocaleLowerCase('uk');
    const limit = this.ageOnly() ? this.ageMonths() : null;
    const skipIntroduced = this.hideIntroduced();
    const byFood = this.recordMap();
    return this.categories()
      .filter((category) => this.categoryId() === 'ALL' || category.id === this.categoryId())
      .map((category) => {
        const introducedCount = category.items.filter(
          (item) => byFood.get(item.id)?.status === 'INTRODUCED',
        ).length;
        return {
          ...category,
          introducedCount,
          totalCount: category.items.length,
          items: category.items.filter((item) => {
            const haystack = `${item.name} ${item.preparationGuide}`.toLocaleLowerCase('uk');
            const matchesQuery = !query || haystack.includes(query);
            const matchesAge = limit === null || item.allowedFromAgeMonths <= limit;
            const matchesStatus = !skipIntroduced || byFood.get(item.id)?.status !== 'INTRODUCED';
            return matchesQuery && matchesAge && matchesStatus;
          }),
        };
      })
      .filter((category) => category.items.length > 0);
  });
  readonly rows = computed(() => {
    const query = this.trackerQuery().trim().toLocaleLowerCase('uk');
    const status = this.trackerStatus();
    const byFood = this.recordMap();
    return this.categories().flatMap((category) =>
      category.items
        .filter((item) => !query || item.name.toLocaleLowerCase('uk').includes(query))
        .filter((item) => status === 'ALL' || (byFood.get(item.id)?.status ?? 'PENDING') === status)
        .map((item) => ({
          food: item,
          categoryName: category.name,
          record: byFood.get(item.id) ?? null,
        })),
    );
  });

  retry(): void {
    this.dictionary.reload();
    this.records.reload();
  }

  setGuideQuery(event: Event): void {
    this.guideQuery.set(controlValue(event));
  }

  setCategory(event: Event): void {
    this.categoryId.set(controlValue(event) || 'ALL');
  }

  selectCategory(id: string): void {
    this.categoryId.set(id);
  }

  setAgeOnly(event: Event): void {
    this.ageOnly.set(event.target instanceof HTMLInputElement && event.target.checked);
  }

  setHideIntroduced(event: Event): void {
    this.hideIntroduced.set(event.target instanceof HTMLInputElement && event.target.checked);
  }

  resetGuideFilters(): void {
    this.guideQuery.set('');
    this.categoryId.set('ALL');
    this.ageOnly.set(false);
    this.hideIntroduced.set(false);
  }

  setTrackerQuery(event: Event): void {
    this.trackerQuery.set(controlValue(event));
  }

  setTrackerStatus(event: Event): void {
    const value = controlValue(event);
    this.trackerStatus.set(isTrackerFilter(value) ? value : 'ALL');
  }

  itemStatus(foodId: string): FeedingStatus {
    return this.recordMap().get(foodId)?.status ?? 'PENDING';
  }

  itemNotes(foodId: string): string | null {
    return this.recordMap().get(foodId)?.notes ?? null;
  }

  statusLabel(status: FeedingStatus): string {
    return FEEDING_STATUS_LABELS[status];
  }

  isEarlyForChild(allowedMonths: number): boolean {
    const age = this.ageMonths();
    return age !== null && age < allowedMonths;
  }

  markIntroduced(item: FoodItem): void {
    if (!this.child() || this.savingFoodId() !== null) return;
    const existingNotes = this.itemNotes(item.id);
    this.savingFoodId.set(item.id);
    this.quickError.set('');
    this.data.upsert(item.id, { status: 'INTRODUCED', notes: existingNotes }).subscribe({
      next: () => this.savingFoodId.set(null),
      error: () => {
        this.savingFoodId.set(null);
        this.quickError.set(FEEDING.saveError);
      },
    });
  }

  openInTracker(item: FoodItem): void {
    this.trackerQuery.set(item.name);
    this.trackerStatus.set('ALL');
    this.tab.set('tracker');
  }
}

function controlValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : '';
}

function isTrackerFilter(value: string): value is FeedingStatus | 'ALL' {
  return value === 'ALL' || FEEDING_STATUSES.some((option) => option.value === value);
}
