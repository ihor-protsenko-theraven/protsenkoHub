import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, timer } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Loader } from '../../shared/loader.component';
import { HOME_CLOCK_REFRESH_MS } from './home.config';
import { HomeService } from './home.service';
import { HomeSleepCard } from './home-sleep-card.component';

@Component({
  selector: 'app-home-page',
  imports: [DatePipe, RouterLink, HomeSleepCard, Loader],
  providers: [HomeService],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly auth = inject(AuthService);
  private readonly home = inject(HomeService);
  readonly snapshot = this.home.snapshot;
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
  readonly shoppingPreview = computed(() => this.openShopping().slice(0, 4).map((item) => item.name).join(', '));
  readonly eventCount = computed(() => this.countLabel(this.snapshot.isLoading(), !!this.snapshot.error(), this.upcoming().length));
  readonly taskCount = computed(() => this.countLabel(this.snapshot.isLoading(), !!this.snapshot.error(), this.openTasks().length));
  readonly shoppingCount = computed(() => this.countLabel(this.snapshot.isLoading(), !!this.snapshot.error(), this.openShopping().length));

  private countLabel(loading: boolean, error: boolean, count: number): string {
    if (loading) return '…';
    if (error) return '—';
    return String(count);
  }
}
