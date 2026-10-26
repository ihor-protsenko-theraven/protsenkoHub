import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormField, form, required } from '@angular/forms/signals';
import { HistoryPanel } from '../../shared/history-panel.component';
import { Loader } from '../../shared/loader.component';
import { toLocalDateTime } from '../../shared/date-time.util';
import { TASK_PRIORITIES, TASK_STATUSES } from './children.config';
import {
  TaskForm,
  TaskItem,
  TaskPayload,
  TaskPriority,
  TaskStatus,
} from './children.model';
import { ChildrenService } from './children.service';
import { normalizePriority, taskPriorityLabel } from './children.util';

const emptyForm = (): TaskForm => ({ title: '', notes: '', dueAt: '', status: 'TODO', priority: 1 });

@Component({
  selector: 'app-children-page',
  imports: [DatePipe, FormField, HistoryPanel, Loader, NgTemplateOutlet, RouterLink],
  providers: [ChildrenService],
  templateUrl: './children-page.component.html',
  styleUrl: './children-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildrenPage {
  private readonly route = inject(ActivatedRoute);
  readonly data = inject(ChildrenService);
  readonly tasks = this.data.tasks;
  readonly availableTasks = computed(() => this.tasks.hasValue() ? this.tasks.value() : []);
  readonly statuses = TASK_STATUSES;
  readonly openStatuses = TASK_STATUSES.filter((option) => option.value !== 'DONE');
  readonly priorities = TASK_PRIORITIES;
  readonly priorityLabel = taskPriorityLabel;
  readonly asPriority = normalizePriority;
  readonly search = signal('');
  readonly status = signal<Exclude<TaskStatus, 'DONE'> | 'ALL'>('ALL');
  private readonly matched = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('uk');
    return this.availableTasks().filter((task) =>
      !query || (task.title + ' ' + (task.notes ?? '')).toLocaleLowerCase('uk').includes(query),
    );
  });
  readonly emptyState = computed(() => {
    if (!this.availableTasks().length) return { title: 'Ще немає задач', description: '' };
    if (this.search().trim()) return { title: 'Відкритих задач не знайдено', description: 'Очистіть пошук або змініть запит.' };
    if (this.status() !== 'ALL') return { title: 'Відкритих задач не знайдено', description: 'Виберіть інший статус.' };
    return { title: 'Усі задачі завершено', description: 'Перегляньте історію нижче.' };
  });
  readonly openTasks = computed(() =>
    this.matched()
      .filter((task) => task.status !== 'DONE' && (this.status() === 'ALL' || task.status === this.status()))
      .sort((a, b) =>
        (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity) ||
        b.priority - a.priority),
  );
  readonly doneTasks = computed(() =>
    this.matched()
      .filter((task) => task.status === 'DONE')
      .sort((a, b) =>
        (b.dueAt ? new Date(b.dueAt).getTime() : 0) - (a.dueAt ? new Date(a.dueAt).getTime() : 0)),
  );
  readonly formOpen = signal(this.route.snapshot.queryParamMap.has('new'));
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

  setPriority(priority: TaskPriority): void {
    this.model.update((current) => ({ ...current, priority }));
  }

  changeStatus(task: TaskItem, status: TaskStatus): void {
    if (status === task.status) return;
    this.busy.set(true);
    this.data.update(task.id, { status }).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(status === 'DONE' ? 'Задачу завершено.' : 'Статус оновлено.');
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
