import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize, map, timer } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Loader } from '../../shared/loader.component';
import type { ShoppingItem } from '../shopping/shopping.model';
import { HOME_CLOCK_REFRESH_MS, HOME_SHOPPING_PREVIEW_LIMIT } from './home.config';
import { HomeService } from './home.service';
import { HomeFeedingCard } from './home-feeding-card.component';
import { HomeSleepCard } from './home-sleep-card.component';

@Component({
  selector: 'app-home-page',
  imports: [DatePipe, RouterLink, HomeFeedingCard, HomeSleepCard, Loader],
  providers: [HomeService],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly auth = inject(AuthService);
  private readonly home = inject(HomeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly snapshot = this.home.snapshot;
  readonly quickItemName = signal('');
  readonly shoppingBusy = signal(false);
  readonly togglingItemId = signal<string | null>(null);
  readonly now = toSignal(timer(0, HOME_CLOCK_REFRESH_MS).pipe(map(() => new Date())), { initialValue: new Date() });
  readonly firstName = computed(() => this.auth.user()?.displayName.trim().split(/\s+/)[0] || 'родино');
  readonly safeEvents = computed(() => this.snapshot.hasValue() ? this.snapshot.value().events : []);
  readonly safeTasks = computed(() => this.snapshot.hasValue() ? this.snapshot.value().tasks : []);
  readonly safeShopping = computed(() => this.snapshot.hasValue() ? this.snapshot.value().shoppingItems : []);
  readonly upcoming = computed(() => this.safeEvents()
    .filter((event) => event.status === 'OPEN' && new Date(event.endsAt).getTime() >= this.now().getTime())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
  readonly openTasks = computed(() => this.safeTasks()
    .filter((task) => task.status !== 'DONE')
    .sort((a, b) =>
      (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity) ||
      b.priority - a.priority));
  readonly openShopping = computed(() => this.safeShopping().filter((item) => !item.isChecked));
  readonly checkedShoppingCount = computed(() => this.safeShopping().filter((item) => item.isChecked).length);
  readonly visibleShopping = computed(() => this.openShopping().slice(0, HOME_SHOPPING_PREVIEW_LIMIT));
  readonly remainingShoppingCount = computed(() => Math.max(0, this.openShopping().length - HOME_SHOPPING_PREVIEW_LIMIT));
  readonly eventCount = computed(() => this.countLabel(this.snapshot.isLoading(), !!this.snapshot.error(), this.upcoming().length));
  readonly taskCount = computed(() => this.countLabel(this.snapshot.isLoading(), !!this.snapshot.error(), this.openTasks().length));
  readonly shoppingCount = computed(() => this.countLabel(this.snapshot.isLoading(), !!this.snapshot.error(), this.openShopping().length));

  setQuickItemName(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.quickItemName.set(target.value);
    }
  }

  addQuickShoppingItem(event: Event): void {
    event.preventDefault();
    const name = this.quickItemName().trim();
    if (!name || this.shoppingBusy()) return;
    this.shoppingBusy.set(true);
    this.home
      .addShoppingItem(name)
      .pipe(
        finalize(() => this.shoppingBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.quickItemName.set(''),
        error: () => undefined,
      });
  }

  checkShoppingItem(item: ShoppingItem): void {
    if (this.togglingItemId()) return;
    this.togglingItemId.set(item.id);
    this.home
      .toggleShoppingItem(item)
      .pipe(
        finalize(() => this.togglingItemId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => undefined });
  }

  private countLabel(loading: boolean, error: boolean, count: number): string {
    if (loading) return '…';
    if (error) return '—';
    return String(count);
  }
}
