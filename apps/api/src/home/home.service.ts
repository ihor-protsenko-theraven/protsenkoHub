import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/types';
import { CalendarService } from '../calendar/calendar.service';
import { ChildrenService } from '../children/children.service';
import { SleepService } from '../children/sleep/sleep.service';
import { FeedingService } from '../feeding/feeding.service';
import { ShoppingService } from '../shopping/shopping.service';
import { HOME_PREVIEW } from './home.config';

@Injectable()
export class HomeService {
  constructor(
    private readonly calendar: CalendarService,
    private readonly children: ChildrenService,
    private readonly shopping: ShoppingService,
    private readonly sleep: SleepService,
    private readonly feeding: FeedingService,
  ) {}

  async snapshot(user: AuthUser) {
    const [events, tasks, shoppingItems, sleep, feeding] = await Promise.all([
      this.calendar.listUpcomingOpen(user),
      this.children.listOpen(user),
      this.shopping.listItems(user),
      this.sleep.homeOverview(user),
      this.feeding.focus(user),
    ]);
    return { events, tasks, shoppingItems, sleep, feeding };
  }

  async preview(user: AuthUser) {
    const [[events, eventCount], [tasks, taskCount], [shoppingItems, counts], sleep, feeding] =
      await Promise.all([
        this.calendar.upcomingPreview(user, HOME_PREVIEW.events),
        this.children.openPreview(user, HOME_PREVIEW.tasks),
        this.shopping.itemsPreview(user, HOME_PREVIEW.shopping),
        this.sleep.homeOverview(user),
        this.feeding.focus(user),
      ]);
    return {
      events, tasks, shoppingItems, sleep, feeding, eventCount, taskCount,
      shoppingOpenCount: counts.find((count) => !count.isChecked)?._count._all ?? 0,
      shoppingCheckedCount: counts.find((count) => count.isChecked)?._count._all ?? 0,
    };
  }
}
