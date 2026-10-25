import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, min, required } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { HistoryPanel } from '../../shared/history-panel.component';
import { ShoppingItem, ShoppingItemForm, ShoppingItemPayload, ShoppingListForm } from './shopping.model';
import { ShoppingService } from './shopping.service';

const emptyForm = (): ShoppingItemForm => ({ name: '', qty: 1, unit: '', category: '' });

@Component({
  selector: 'app-shopping-page',
  imports: [FormField, HistoryPanel, NgTemplateOutlet],
  providers: [ShoppingService],
  templateUrl: './shopping.page.html',
  styleUrl: './shopping.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingPage {
  private readonly route = inject(ActivatedRoute);
  readonly data = inject(ShoppingService);
  readonly items = this.data.items;
  readonly lists = this.data.lists;
  readonly availableItems = computed(() => this.items.hasValue() ? this.items.value() : []);
  readonly availableLists = computed(() => this.lists.hasValue() ? this.lists.value() : []);
  readonly search = signal('');
  readonly categories = computed(() =>
    [...new Set(this.availableItems().map((item) => item.category).filter((value): value is string => !!value))].sort(),
  );
  readonly category = signal('');
  private readonly matched = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('uk');
    return this.availableItems().filter((item) =>
      (!this.category() || item.category === this.category()) &&
      (!query || item.name.toLocaleLowerCase('uk').includes(query)),
    );
  });
  readonly namedGroups = computed(() => this.availableLists().map((list) => {
    const all = this.availableItems().filter((item) => item.listId === list.id);
    return {
      ...list,
      checked: all.filter((item) => item.isChecked).length,
      total: all.length,
      visible: this.matched().filter((item) => item.listId === list.id),
    };
  }));
  readonly singleItems = computed(() => {
    const namedIds = new Set(this.availableLists().map((list) => list.id));
    return this.matched().filter((item) => !namedIds.has(item.listId) && !item.isChecked);
  });
  readonly singleDone = computed(() => {
    const namedIds = new Set(this.availableLists().map((list) => list.id));
    return this.matched().filter((item) => !namedIds.has(item.listId) && item.isChecked);
  });
  readonly formOpen = signal(this.route.snapshot.queryParamMap.has('new'));
  readonly listFormOpen = signal(false);
  readonly targetListId = signal<string | null>(null);
  readonly deletingListId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly model = signal<ShoppingItemForm>(emptyForm());
  readonly itemForm = form(this.model, (path) => {
    required(path.name);
    min(path.qty, 0.01);
  });
  readonly listModel = signal<ShoppingListForm>({ name: '', items: '' });
  readonly listForm = form(this.listModel, (path) => {
    required(path.name);
    required(path.items);
  });

  createNew(listId: string | null = null): void {
    this.editingId.set(null);
    this.targetListId.set(listId);
    this.model.set(emptyForm());
    this.error.set('');
    this.listFormOpen.set(false);
    this.formOpen.set(true);
  }

  createNewList(): void {
    this.listModel.set({ name: '', items: '' });
    this.error.set('');
    this.formOpen.set(false);
    this.listFormOpen.set(true);
  }

  cancelList(): void {
    this.listFormOpen.set(false);
    this.error.set('');
  }

  saveList(): void {
    const draft = this.listModel();
    const items = draft.items.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (!draft.name.trim() || !items.length) {
      this.error.set('Вкажіть назву й хоча б одну покупку.');
      return;
    }
    this.busy.set(true);
    this.data.createList({ name: draft.name.trim(), items }).subscribe({
      next: () => {
        this.busy.set(false);
        this.listFormOpen.set(false);
        this.error.set('');
        this.notice.set('Список створено.');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Список не створено. Спробуйте ще раз.');
      },
    });
  }

  edit(item: ShoppingItem): void {
    this.editingId.set(item.id);
    this.targetListId.set(item.listId);
    this.model.set({
      name: item.name,
      qty: item.qty,
      unit: item.unit ?? '',
      category: item.category ?? '',
    });
    this.error.set('');
    this.listFormOpen.set(false);
    this.formOpen.set(true);
  }

  cancel(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.error.set('');
  }

  save(): void {
    const value = this.model();
    if (!value.name.trim() || !Number.isFinite(value.qty) || value.qty <= 0) {
      this.error.set('Вкажіть назву й кількість понад нуль.');
      return;
    }
    const payload: ShoppingItemPayload = {
      name: value.name.trim(),
      ...(this.targetListId() && !this.editingId() ? { listId: this.targetListId()! } : {}),
      qty: value.qty,
      unit: value.unit.trim() || null,
      category: value.category.trim() || null,
    };
    this.busy.set(true);
    const id = this.editingId();
    const item = this.availableItems().find((entry) => entry.id === id);
    if (id && !item) {
      this.busy.set(false);
      this.error.set('Покупка недоступна. Перевірте список.');
      this.items.reload();
      return;
    }
    const request = id && item
      ? this.data.update(id, { ...payload, version: item.version })
      : this.data.create(payload);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(id ? 'Покупку оновлено.' : 'Покупку додано.');
        this.cancel();
      },
      error: (response: { status?: number }) => {
        this.busy.set(false);
        if (response.status === 409) this.items.reload();
        this.error.set(response.status === 409
          ? 'Покупку змінено на іншому пристрої. Перевірте й повторіть.'
          : 'Покупку не збережено. Спробуйте ще раз.');
      },
    });
  }

  toggle(item: ShoppingItem): void {
    this.busy.set(true);
    this.data.update(item.id, { isChecked: !item.isChecked, version: item.version }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(item.isChecked ? 'Повернуто до списку.' : 'Позначено як куплене.');
      },
      error: (response: { status?: number }) => {
        this.busy.set(false);
        if (response.status === 409) this.items.reload();
        this.error.set(response.status === 409
          ? 'Покупку змінено на іншому пристрої. Перевірте й повторіть.'
          : 'Не вдалося оновити покупку. Спробуйте ще раз.');
      },
    });
  }

  remove(id: string): void {
    this.busy.set(true);
    this.data.remove(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deletingId.set(null);
        this.notice.set('Покупку видалено.');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося видалити покупку.');
      },
    });
  }

  removeList(id: string): void {
    this.busy.set(true);
    this.data.removeList(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deletingListId.set(null);
        this.notice.set('Список видалено.');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося видалити список.');
      },
    });
  }
}
