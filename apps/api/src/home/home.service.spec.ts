import type { AuthUser } from '../common/types';
import type { CalendarService } from '../calendar/calendar.service';
import type { ChildrenService } from '../children/children.service';
import type { SleepService } from '../children/sleep/sleep.service';
import type { ShoppingService } from '../shopping/shopping.service';
import { HomeService } from './home.service';

const user = { userId: 'parent-1' } as AuthUser;

describe('home snapshot', () => {
  it('loads events, tasks, shopping and sleep in one round', async () => {
    const calendar = { list: vi.fn().mockResolvedValue(['event']) };
    const children = { list: vi.fn().mockResolvedValue(['task']) };
    const shopping = { listItems: vi.fn().mockResolvedValue(['item']) };
    const sleep = { overview: vi.fn().mockResolvedValue({ active: null }) };
    const service = new HomeService(
      calendar as unknown as CalendarService,
      children as unknown as ChildrenService,
      shopping as unknown as ShoppingService,
      sleep as unknown as SleepService,
    );

    await expect(service.snapshot(user)).resolves.toEqual({
      events: ['event'],
      tasks: ['task'],
      shoppingItems: ['item'],
      sleep: { active: null },
    });
    expect(calendar.list).toHaveBeenCalledWith(user);
    expect(children.list).toHaveBeenCalledWith(user);
    expect(shopping.listItems).toHaveBeenCalledWith(user);
    expect(sleep.overview).toHaveBeenCalledWith(user);
  });
});
