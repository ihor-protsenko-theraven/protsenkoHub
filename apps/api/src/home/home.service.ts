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
    const [events, tasks, shoppingItems, sleep, feeding] = await Promise.all([
      this.calendar.list(user),
      this.children.list(user),
      this.shopping.listItems(user),
      this.sleep.overview(user),
      this.feeding.focus(user),
    ]);
    return { events, tasks, shoppingItems, sleep, feeding };
  }
}
