import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form, required } from '@angular/forms/signals';
import { toLocalDateTime } from '../../shared/date-time.util';
import {
  normalizePriority,
  TASK_PRIORITIES,
  TaskForm,
  TaskItem,
  TaskPayload,
  TaskPriority,
  TaskStatus,
  TASK_STATUSES,
  taskPriorityLabel,
} from './children.model';
import { ChildrenService } from './children.service';

const emptyForm = (): TaskForm => ({ title: '', notes: '', dueAt: '', status: 'TODO', priority: 1 });

@Component({
  selector: 'app-children-page',
  imports: [DatePipe, FormField, RouterLink],
  providers: [ChildrenService],
  templateUrl: './children-page.component.html',
  styleUrl: './children-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildrenPage {
  readonly data = inject(ChildrenService);
  readonly tasks = this.data.tasks;
  readonly statuses = TASK_STATUSES;
  readonly priorities = TASK_PRIORITIES;
  readonly priorityLabel = taskPriorityLabel;
  readonly asPriority = normalizePriority;
  readonly search = signal('');
  readonly status = signal<TaskStatus | 'ALL'>('ALL');
  readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('uk');
    return this.tasks.value()
      .filter((task) => (this.status() === 'ALL' || task.status === this.status()) &&
        (!query || (task.title + ' ' + (task.notes ?? '')).toLocaleLowerCase('uk').includes(query)))
      .sort((a, b) => Number(a.status === 'DONE') - Number(b.status === 'DONE') ||
        (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity) ||
        b.priority - a.priority);
  });
  readonly formOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly model = signal<TaskForm>(emptyForm());
  readonly taskForm = form(this.model, (path) => required(path.title));

  createNew(): void {
    this.editingId.set(null);
    this.model.set(emptyForm());
    this.error.set('');
    this.formOpen.set(true);
  }

  edit(task: TaskItem): void {
    this.editingId.set(task.id);
    this.model.set({
      title: task.title,
      notes: task.notes ?? '',
      dueAt: task.dueAt ? toLocalDateTime(task.dueAt) : '',
      status: task.status,
      priority: normalizePriority(task.priority),
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
    const dueAt = value.dueAt ? new Date(value.dueAt) : null;
    if (!value.title.trim() || (dueAt && !Number.isFinite(dueAt.getTime()))) {
      this.error.set('Вкажіть назву і коректний термін.');
      return;
    }
    const payload: TaskPayload = {
      title: value.title.trim(),
      notes: value.notes.trim() || null,
      dueAt: dueAt?.toISOString() ?? null,
      status: value.status,
      priority: value.priority,
    };
    this.busy.set(true);
    const id = this.editingId();
    const request = id ? this.data.update(id, payload) : this.data.create(payload);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(id ? 'Задачу оновлено.' : 'Задачу додано.');
        this.cancel();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося зберегти задачу.');
      },
    });
  }

  recordCount(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? 'запис'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'записи'
          : 'записів';
    return `${count} ${word}`;
  }

  setPriority(priority: TaskPriority): void {
    this.model.update((current) => ({ ...current, priority }));
  }

  changeStatus(task: TaskItem, status: TaskStatus): void {
    if (status === task.status) return;
    this.busy.set(true);
    this.data.update(task.id, { status }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set('Статус оновлено.');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося змінити статус.');
      },
    });
  }

  remove(id: string): void {
    this.busy.set(true);
    this.data.remove(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deletingId.set(null);
        this.notice.set('Задачу видалено.');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Не вдалося видалити задачу.');
      },
    });
  }
}
