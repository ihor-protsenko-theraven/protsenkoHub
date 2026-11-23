import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/types';
import { CalendarService } from '../calendar/calendar.service';
import { ChildrenService } from '../children/children.service';
import { SleepService } from '../children/sleep/sleep.service';
import { FeedingService } from '../feeding/feeding.service';
import { ShoppingService } from '../shopping/shopping.service';

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
    const [events, tasks, shoppingItems, sleepOverview, feeding] =
      await Promise.all([
        this.calendar.listUpcomingOpen(user),
        this.children.listOpen(user),
        this.shopping.listItems(user),
        this.sleep.overview(user),
        this.feeding.focus(user),
      ]);
    const sleep = {
      ...sleepOverview,
      sessions: [],
      todayBlocks: [],
      week: [],
      schedule: [],
      signals: [],
      howItWorks: [],
      disclaimer: '',
    };
    return { events, tasks, shoppingItems, sleep, feeding };
  }
}
