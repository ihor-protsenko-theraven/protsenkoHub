import type { CalendarEvent } from '../calendar/calendar.model';
import type { TaskItem } from '../children/children.model';
import type { FeedingFocus } from '../feeding/feeding.model';
import type { ShoppingItem } from '../shopping/shopping.model';
import type { SleepOverview } from '../sleep/sleep.model';

export type HomeShoppingItem = Pick<ShoppingItem, 'id' | 'name' | 'qty' | 'unit' | 'category' | 'isChecked' | 'version'>;

export interface HomeSnapshot {
  events: Pick<CalendarEvent, 'id' | 'title' | 'status' | 'startsAt' | 'endsAt'>[];
  tasks: Pick<TaskItem, 'id' | 'title' | 'status' | 'priority' | 'dueAt'>[];
  shoppingItems: HomeShoppingItem[];
  eventCount?: number;
  taskCount?: number;
  shoppingOpenCount?: number;
  shoppingCheckedCount?: number;
  sleep: SleepOverview;
  feeding: FeedingFocus;
}
