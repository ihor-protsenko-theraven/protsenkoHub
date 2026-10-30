import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { FormField, form, min, required } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import type { Observable } from 'rxjs';
import { ToastService } from '../../core/toast/toast.service';
import { HistoryPanel } from '../../shared/history-panel.component';
import { Loader } from '../../shared/loader.component';
import {
  ShoppingFilterForm,
  ShoppingItem,
  ShoppingItemForm,
  ShoppingItemPayload,
  ShoppingListForm,
  ShoppingQuickForm,
} from './shopping.model';
import { ShoppingService } from './shopping.service';
import { isWithinHistory } from './shopping.config';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';


const emptyForm = (): ShoppingItemForm => ({ name: '', qty: 1, unit: '', category: '' });
const CONFLICT_MESSAGE = 'Покупку змінено на іншому пристрої. Перевірте й повторіть.';

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : undefined;
}

@Component({
  selector: 'app-shopping-page',
  imports: [FormField, HistoryPanel, Loader, NgTemplateOutlet],
  providers: [ShoppingService],
  templateUrl: './shopping.page.html',
  styleUrl: './shopping.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingPage {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toasts = inject(ToastService);
  readonly data = inject(ShoppingService);
  readonly items = this.data.items;
  readonly lists = this.data.lists;
  readonly availableItems = computed(() => (this.items.hasValue() ? this.items.value() : []));
  readonly availableLists = computed(() => (this.lists.hasValue() ? this.lists.value() : []));

  readonly filterModel = signal<ShoppingFilterForm>({ search: '', category: '' });
  readonly filterForm = form(this.filterModel);
  readonly search = computed(() => this.filterModel().search);
  readonly category = computed(() => this.filterModel().category);
  readonly categories = computed(() =>
    [...new Set(this.availableItems().map((item) => item.category).filter((value): value is string => !!value))].sort(
      (a, b) => a.localeCompare(b, 'uk'),
    ),
  );
  private readonly matched = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('uk');
    return this.availableItems().filter(
      (item) =>
        (!this.category() || item.category === this.category()) &&
        (!query || item.name.toLocaleLowerCase('uk').includes(query)),
    );
  });
  readonly namedGroups = computed(() =>
    this.availableLists()
      .map((list) => {
        const all = this.availableItems().filter((item) => item.listId === list.id);
        const checked = all.filter((item) => item.isChecked).length;
        return {
          ...list,
          checked,
          total: all.length,
          progress: all.length ? Math.round((checked / all.length) * 100) : 0,
          isCompleted: all.length > 0 && checked === all.length,
          visible: this.matched()
            .filter((item) => item.listId === list.id)
            .sort((a, b) => Number(a.isChecked) - Number(b.isChecked)),
        };
      })
      .filter(
        (group) =>
          !group.isCompleted &&
          (!this.search().trim() && !this.category() || group.visible.length > 0),
      ),
  );

  readonly completedGroups = computed(() =>
    this.availableLists()
      .map((list) => {
        const all = this.availableItems().filter((item) => item.listId === list.id);
        const checked = all.filter((item) => item.isChecked).length;
        const latestUpdate = all.reduce<string | undefined>((latest, it) => {
          const d = it.updatedAt ?? it.createdAt;
          return d && (!latest || d > latest) ? d : latest;
        }, list.updatedAt ?? list.createdAt);

        return {
          ...list,
          checked,
          total: all.length,
          progress: 100,
          isCompleted: all.length > 0 && checked === all.length,
          isRecent: isWithinHistory(latestUpdate),
          visible: this.matched().filter((item) => item.listId === list.id),
        };
      })
      .filter(
        (group) =>
          group.isCompleted &&
          group.isRecent &&
          (!this.search().trim() && !this.category() || group.visible.length > 0),
      ),
  );

  readonly singleItems = computed(() => {
    const namedIds = new Set(this.availableLists().map((list) => list.id));
    return this.matched().filter((item) => !namedIds.has(item.listId) && !item.isChecked);
  });

  readonly singleDone = computed(() => {
    const namedIds = new Set(this.availableLists().map((list) => list.id));
    return this.matched().filter(
      (item) => !namedIds.has(item.listId) && item.isChecked && isWithinHistory(item.updatedAt ?? item.createdAt),
    );
  });

  readonly historyCount = computed(
    () => this.singleDone().length + this.completedGroups().reduce((acc, g) => acc + g.visible.length, 0),
  );

  readonly formOpen = signal(this.route.snapshot.queryParamMap.has('new'));
  readonly listFormOpen = signal(false);
  readonly targetListId = signal<string | null>(null);
  readonly deletingListId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly expandedId = signal<string | null>(null);
  readonly pendingIds = signal<ReadonlySet<string>>(new Set());
  readonly busy = signal(false);
  readonly error = signal('');

  readonly quickModel = signal<ShoppingQuickForm>({ name: '' });
  readonly quickForm = form(this.quickModel);
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

  private readonly quickInput = viewChild<ElementRef<HTMLInputElement>>('quickInput');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly listNameInput = viewChild<ElementRef<HTMLInputElement>>('listNameInput');

  constructor() {
    effect(() => {
      this.nameInput()?.nativeElement.focus();
    });
    effect(() => {
      this.listNameInput()?.nativeElement.focus();
    });
  }

  quickAdd(): void {
    const name = this.quickModel().name.trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    this.send(
      this.data.create({ name, qty: 1 }),
      () => {
        this.busy.set(false);
        this.quickModel.set({ name: '' });
        this.quickInput()?.nativeElement.focus();
      },
      () => this.busy.set(false),
    );
  }

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

  closeSheets(): void {
    this.cancel();
    this.cancelList();
  }

  saveList(): void {
    const draft = this.listModel();
    const items = draft.items.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (!draft.name.trim() || !items.length) {
      this.error.set('Вкажіть назву й хоча б одну покупку.');
      return;
    }
    this.busy.set(true);
    this.send(
      this.data.createList({ name: draft.name.trim(), items }),
      () => {
        this.busy.set(false);
        this.listFormOpen.set(false);
        this.error.set('');
        this.toasts.success('Список створено.');
      },
      () => {
        this.busy.set(false);
        this.error.set('Список не створено. Спробуйте ще раз.');
      },
    );
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
    this.collapseActions();
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
    const listId = this.targetListId();
    const payload: ShoppingItemPayload = {
      name: value.name.trim(),
      ...(listId && !this.editingId() ? { listId } : {}),
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
    const request = id && item ? this.data.update(id, { ...payload, version: item.version }) : this.data.create(payload);
    this.send(
      request,
      () => {
        this.busy.set(false);
        this.toasts.success(id ? 'Покупку оновлено.' : 'Покупку додано.');
        this.cancel();
      },
      (status) => {
        this.busy.set(false);
        if (status === 409) this.items.reload();
        this.error.set(status === 409 ? CONFLICT_MESSAGE : 'Покупку не збережено. Спробуйте ще раз.');
      },
    );
  }

  toggle(item: ShoppingItem): void {
    this.setPending(item.id, true);
    this.send(
      this.data.toggle(item),
      () => this.setPending(item.id, false),
      (status) => {
        this.setPending(item.id, false);
        this.items.reload();
        if (status === 409) this.toasts.error(CONFLICT_MESSAGE);
      },
    );
  }

  toggleActions(id: string): void {
    this.deletingId.set(null);
    this.expandedId.update((current) => (current === id ? null : id));
  }

  remove(id: string): void {
    this.busy.set(true);
    this.send(
      this.data.remove(id),
      () => {
        this.busy.set(false);
        this.collapseActions();
        this.toasts.success('Покупку видалено.');
      },
      () => this.busy.set(false),
    );
  }

  removeList(id: string): void {
    this.busy.set(true);
    this.send(
      this.data.removeList(id),
      () => {
        this.busy.set(false);
        this.deletingListId.set(null);
        this.toasts.success('Список видалено.');
      },
      () => this.busy.set(false),
    );
  }

  private collapseActions(): void {
    this.deletingId.set(null);
    this.expandedId.set(null);
  }

  private setPending(id: string, pending: boolean): void {
    this.pendingIds.update((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Помилки API вже показує глобальний toast; тут лише скидається стан екрана. */
  private send<T>(request: Observable<T>, onSuccess: () => void, onError: (status: number | undefined) => void): void {
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => onSuccess(),
      error: (error: unknown) => onError(statusOf(error)),
    });
  }
}
