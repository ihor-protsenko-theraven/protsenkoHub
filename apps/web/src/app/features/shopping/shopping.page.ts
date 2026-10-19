import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, min, required } from '@angular/forms/signals';
import { ShoppingItem, ShoppingItemForm, ShoppingItemPayload } from './shopping.model';
import { ShoppingService } from './shopping.service';

const emptyForm = (): ShoppingItemForm => ({ name: '', qty: 1, unit: '', category: '' });

@Component({
  selector: 'app-shopping-page',
  imports: [FormField],
  providers: [ShoppingService],
  templateUrl: './shopping.page.html',
  styleUrl: './shopping.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingPage {
  readonly data = inject(ShoppingService);
  readonly items = this.data.items;
  readonly search = signal('');
  readonly status = signal<'open' | 'done' | 'all'>('open');
  readonly categories = computed(() =>
    [...new Set(this.items.value().map((item) => item.category).filter((value): value is string => !!value))].sort(),
  );
  readonly category = signal('');
  readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('uk');
    return this.items.value().filter((item) =>
      (this.status() === 'all' || item.isChecked === (this.status() === 'done')) &&
      (!this.category() || item.category === this.category()) &&
      (!query || item.name.toLocaleLowerCase('uk').includes(query)),
    );
  });
  readonly openCount = computed(() => this.items.value().filter((item) => !item.isChecked).length);
  readonly doneCount = computed(() => this.items.value().filter((item) => item.isChecked).length);
  readonly formOpen = signal(false);
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

  createNew(): void {
    this.editingId.set(null);
    this.model.set(emptyForm());
    this.error.set('');
    this.formOpen.set(true);
  }

  edit(item: ShoppingItem): void {
    this.editingId.set(item.id);
    this.model.set({
      name: item.name,
      qty: item.qty,
      unit: item.unit ?? '',
      category: item.category ?? '',
    });
    this.error.set('');
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
      this.error.set('Вкажіть назву та кількість більше нуля.');
      return;
    }
    const payload: ShoppingItemPayload = {
      name: value.name.trim(),
      qty: value.qty,
      unit: value.unit.trim() || null,
      category: value.category.trim() || null,
    };
    this.busy.set(true);
    const id = this.editingId();
    const item = this.items.value().find((entry) => entry.id === id);
    if (id && !item) {
      this.busy.set(false);
      this.error.set('Цей запис уже не доступний. Оновіть список і спробуйте ще раз.');
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
          ? 'Список змінився на іншому пристрої. Дані оновлено — перевірте запис і повторіть.'
          : 'Не вдалося зберегти покупку.');
      },
    });
  }

  toggle(item: ShoppingItem): void {
    this.busy.set(true);
    this.data.update(item.id, { isChecked: !item.isChecked, version: item.version }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(item.isChecked ? 'Повернуто до списку покупок.' : 'Позначено як куплене.');
      },
      error: (response: { status?: number }) => {
        this.busy.set(false);
        if (response.status === 409) this.items.reload();
        this.error.set('Не вдалося змінити статус. Список оновлено, спробуйте ще раз.');
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
}
