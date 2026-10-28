import type { CalendarEvent } from '../calendar/calendar.model';
import type { TaskItem } from '../children/children.model';
import type { FeedingFocus } from '../feeding/feeding.model';
import type { ShoppingItem } from '../shopping/shopping.model';
import type { SleepOverview } from '../sleep/sleep.model';

export interface HomeSnapshot {
  events: CalendarEvent[];
  tasks: TaskItem[];
  shoppingItems: ShoppingItem[];
  sleep: SleepOverview;
  feeding: FeedingFocus;
}
