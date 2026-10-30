import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ToastService } from '../../core/toast/toast.service';
import { ShoppingItem, ShoppingItemPayload, ShoppingList } from './shopping.model';
import { ShoppingPage } from './shopping.page';
import { ShoppingService } from './shopping.service';

function item(id: string, name: string, overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return { id, name, listId: 'default', qty: 1, unit: null, category: null, isChecked: false, version: 1, ...overrides };
}

function resource<T>(initial: T) {
  const value = signal(initial);
  return { value, hasValue: () => true, error: () => undefined, isLoading: () => false, reload: vi.fn() };
}

function query<T extends Element>(host: HTMLElement, selector: string): T {
  const element = host.querySelector<T>(selector);
  if (!element) throw new Error(`Немає елемента ${selector}`);
  return element;
}

async function setup(initialItems: ShoppingItem[], initialLists: ShoppingList[] = []) {
  const create = vi.fn((_payload: ShoppingItemPayload) => of(item('new', 'new')));
  const toggle = vi.fn((entry: ShoppingItem) => of(entry));
  const service = {
    items: resource(initialItems),
    lists: resource(initialLists),
    create,
    toggle,
    update: vi.fn(() => of(null)),
    remove: vi.fn(() => of(null)),
  };
  TestBed.configureTestingModule({
    imports: [ShoppingPage],
    providers: [provideRouter([]), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }],
  });
  TestBed.overrideComponent(ShoppingPage, { set: { providers: [{ provide: ShoppingService, useValue: service }] } });
  const fixture = TestBed.createComponent(ShoppingPage);
  fixture.detectChanges();
  await fixture.whenStable();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, create, toggle };
}

describe('ShoppingPage mobile UX', () => {
  it('adds a purchase from the quick field and clears it', async () => {
    const { fixture, host, create } = await setup([]);
    const input = query<HTMLInputElement>(host, '.quick-add input');
    input.value = '  Молоко ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    query<HTMLFormElement>(host, '.quick-add').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith({ name: 'Молоко', qty: 1 });
    expect(input.value).toBe('');
  });

  it('toggles a purchase by tapping the whole row without a layout-shifting notice', async () => {
    const { fixture, host, toggle } = await setup([item('a', 'Хліб')]);
    query<HTMLButtonElement>(host, '.shopping-item__toggle').click();
    fixture.detectChanges();

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('reveals row actions only after the more button is pressed', async () => {
    const { fixture, host } = await setup([item('a', 'Хліб')]);
    const row = query<HTMLElement>(host, '.shopping-item');
    const more = query<HTMLButtonElement>(row, '.shopping-item__more');
    expect(row.classList.contains('is-open')).toBe(false);
    expect(more.getAttribute('aria-expanded')).toBe('false');

    more.click();
    fixture.detectChanges();
    expect(row.classList.contains('is-open')).toBe(true);
    expect(more.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the detailed form as a sheet and closes it with the backdrop', async () => {
    const { fixture, host } = await setup([]);
    query<HTMLButtonElement>(host, '.shopping-shortcuts .button').click();
    fixture.detectChanges();
    expect(host.querySelector('.shopping-sheet')).not.toBeNull();

    query<HTMLElement>(host, '.sheet-backdrop').click();
    fixture.detectChanges();
    expect(host.querySelector('.shopping-sheet')).toBeNull();
  });

  it('puts unchecked purchases before checked ones inside a list', async () => {
    const { host } = await setup(
      [item('a', 'Куплене', { listId: 'l1', isChecked: true }), item('b', 'Потрібне', { listId: 'l1' })],
      [{ id: 'l1', name: 'Вихідні', isDefault: false }],
    );
    const names = [...host.querySelectorAll('.shopping-group .shopping-item__name')].map((el) => el.textContent?.trim());
    expect(names).toEqual(['Потрібне', 'Куплене']);
  });

  it('hides fully completed list from active lists and moves it to history', async () => {
    const { fixture, host } = await setup(
      [
        item('a', 'Куточок', { listId: 'l1', isChecked: true }),
        item('b', 'Клей', { listId: 'l1', isChecked: true }),
      ],
      [{ id: 'l1', name: 'Будівництво', isDefault: false }],
    );
    expect(host.querySelector('.shopping-list-heading')).toBeNull();
    const count = query<HTMLElement>(host, '.history-panel__count');
    expect(count.textContent?.trim()).toBe('2');

    const historyDetails = query<HTMLDetailsElement>(host, 'details.history-panel');
    historyDetails.open = true;
    historyDetails.dispatchEvent(new Event('toggle'));
    fixture.detectChanges();
    await fixture.whenStable();

    const historyList = host.querySelector('.shopping-group--completed');
    expect(historyList).not.toBeNull();
    expect(historyList?.querySelector('h4')?.textContent?.trim()).toBe('Будівництво');
  });

  it('excludes items older than 21 days from history', async () => {
    const twentyFiveDaysAgo = new Date(Date.now() - 25 * 86_400_000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const { host } = await setup([
      item('old', 'Старий хліб', { isChecked: true, updatedAt: twentyFiveDaysAgo }),
      item('recent', 'Свіжий чай', { isChecked: true, updatedAt: twoDaysAgo }),
    ]);
    const count = query<HTMLElement>(host, '.history-panel__count');
    expect(count.textContent?.trim()).toBe('1');
  });

  it('renders active lists as open accordions', async () => {
    const { host } = await setup(
      [item('a', 'Гвинти', { listId: 'l1' })],
      [{ id: 'l1', name: 'Майстерня', isDefault: false }],
    );
    const details = query<HTMLDetailsElement>(host, 'details.shopping-group');
    expect(details.open).toBe(true);
    expect(details.querySelector('.shopping-group__summary')).not.toBeNull();
  });
});
