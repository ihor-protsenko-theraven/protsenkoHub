import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, timer } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CalendarService } from '../calendar/calendar.service';
import { ChildrenService } from '../children/children.service';
import { ShoppingService } from '../shopping/shopping.service';
import { HOME_CLOCK_REFRESH_MS } from './home.config';
import { HomeSleepCard } from './home-sleep-card.component';

@Component({
  selector: 'app-home-page',
  imports: [DatePipe, RouterLink, HomeSleepCard],
  providers: [CalendarService, ChildrenService, ShoppingService],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly auth = inject(AuthService);
  readonly calendar = inject(CalendarService);
  readonly children = inject(ChildrenService);
  readonly shopping = inject(ShoppingService);
  readonly now = toSignal(timer(0, HOME_CLOCK_REFRESH_MS).pipe(map(() => new Date())), { initialValue: new Date() });
  readonly firstName = computed(() => this.auth.user()?.displayName.trim().split(/\s+/)[0] || 'родино');
  readonly safeEvents = computed(() => this.calendar.events.hasValue() ? this.calendar.events.value() : []);
  readonly safeTasks = computed(() => this.children.tasks.hasValue() ? this.children.tasks.value() : []);
  readonly safeShopping = computed(() => this.shopping.items.hasValue() ? this.shopping.items.value() : []);
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
  readonly eventCount = computed(() => this.countLabel(this.calendar.events.isLoading(), !!this.calendar.events.error(), this.upcoming().length));
  readonly taskCount = computed(() => this.countLabel(this.children.tasks.isLoading(), !!this.children.tasks.error(), this.openTasks().length));
  readonly shoppingCount = computed(() => this.countLabel(this.shopping.items.isLoading(), !!this.shopping.items.error(), this.openShopping().length));

  private countLabel(loading: boolean, error: boolean, count: number): string {
    if (loading) return '…';
    if (error) return '—';
    return String(count);
  }
}
