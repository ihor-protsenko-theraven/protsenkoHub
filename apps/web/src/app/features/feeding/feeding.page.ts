import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { RouterLink } from '@angular/router';
import { Loader } from '../../shared/loader.component';
import { FEEDING, FEEDING_STATUSES, FEEDING_TABS, FEEDING_TIPS, FeedingTab } from './feeding.config';
import { formatAgeMonths, formatAllowedFrom } from './feeding-age.util';
import { feedingGuideSteps } from './feeding-guide.util';
import { FeedingTrackerCard } from './feeding-tracker-card.component';
import { FeedingService } from './feeding.service';
import { FeedingStatus } from './feeding.model';

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
  readonly trackerQuery = signal('');
  readonly trackerStatus = signal<FeedingStatus | 'ALL'>('ALL');
  readonly loading = computed(() => this.dictionary.status() === 'loading' || this.records.status() === 'loading');
  readonly failed = computed(() => this.dictionary.status() === 'error' || this.records.status() === 'error');
  readonly categories = computed(() => this.dictionary.hasValue() ? this.dictionary.value() : []);
  readonly tracker = computed(() => this.records.hasValue() ? this.records.value() : null);
  readonly child = computed(() => this.tracker()?.child ?? null);
  readonly ageMonths = computed(() => this.child()?.ageMonths ?? null);
  readonly guideCategories = computed(() => {
    const query = this.guideQuery().trim().toLocaleLowerCase('uk');
    const limit = this.ageOnly() ? this.ageMonths() : null;
    return this.categories()
      .filter((category) => this.categoryId() === 'ALL' || category.id === this.categoryId())
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          const haystack = `${item.name} ${item.preparationGuide}`.toLocaleLowerCase('uk');
          const matchesQuery = !query || haystack.includes(query);
          const matchesAge = limit === null || item.allowedFromAgeMonths <= limit;
          return matchesQuery && matchesAge;
        }),
      }))
      .filter((category) => category.items.length > 0);
  });
  readonly rows = computed(() => {
    const query = this.trackerQuery().trim().toLocaleLowerCase('uk');
    const status = this.trackerStatus();
    const byFood = new Map((this.tracker()?.records ?? []).map((record) => [record.foodItemId, record]));
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

  setAgeOnly(event: Event): void {
    this.ageOnly.set(event.target instanceof HTMLInputElement && event.target.checked);
  }

  setTrackerQuery(event: Event): void {
    this.trackerQuery.set(controlValue(event));
  }

  setTrackerStatus(event: Event): void {
    const value = controlValue(event);
    this.trackerStatus.set(isTrackerFilter(value) ? value : 'ALL');
  }
}

function controlValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : '';
}

function isTrackerFilter(value: string): value is FeedingStatus | 'ALL' {
  return value === 'ALL' || FEEDING_STATUSES.some((option) => option.value === value);
}
