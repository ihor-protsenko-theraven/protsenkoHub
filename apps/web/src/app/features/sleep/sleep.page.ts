import {DatePipe} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {form, FormField, required} from '@angular/forms/signals';
import {toLocalDateTime} from '../../shared/date-time.util';
import {asleepMs, elapsedMs, formatClockDuration, formatMinutes} from './sleep-clock';
import {SLEEP_UI} from './sleep.config';
import {SleepForm, SleepKind, sleepKindLabel, SleepOverview, SleepPause, SleepPayload, SleepSession, WeekDay,} from './sleep.model';
import {SleepService} from './sleep.service';
import {SleepReminderService} from './sleep-reminder.service';

const emptyForm = (): SleepForm => ({kind: 'NAP', startedAt: '', endedAt: '', notes: ''});

@Component({
  selector: 'app-sleep-page',
  imports: [DatePipe, FormField],
  providers: [SleepService, SleepReminderService],
  templateUrl: './sleep.page.html',
  styleUrl: './sleep.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SleepPage {
  readonly data = inject(SleepService);
  readonly reminders = inject(SleepReminderService);
  private readonly destroyRef = inject(DestroyRef);
  readonly kindLabel = sleepKindLabel;
  readonly minutes = formatMinutes;
  readonly snapshot = signal<SleepOverview | null>(null);
  readonly clockOffset = signal(0);
  readonly tick = signal(0);
  readonly minuteTick = signal(0);
  readonly kind = signal<SleepKind>('NAP');
  readonly backdate = signal('');
  readonly wakeAt = signal('');
  readonly birthDate = signal('');
  readonly formOpen = signal(false);
  readonly adjust = signal<'start' | 'pause' | null>(null);
  readonly adjustTime = signal('');
  readonly pauseEndTime = signal('');
  readonly editingPauseId = signal<string | null>(null);
  readonly pauseClosed = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly model = signal<SleepForm>(emptyForm());
  readonly sleepForm = form(this.model, (path) => required(path.startedAt));
  private kindTouched = false;
  private birthEdited = false;
  private lastActiveId: string | null | undefined = undefined;
  private lastMinute = -1;

  readonly phase = computed(() => {
    this.tick();
    const sleep = this.snapshot();
    if (!sleep) return null;
    const offset = this.clockOffset();
    if (sleep.active) {
      const pauses = sleep.active.pauses ?? [];
      const open = pauses.find((pause) => pause.endedAt === null) ?? null;
      const asleep = asleepMs(sleep.active.startedAt, null, pauses, Date.now(), offset);
      return {
        mode: open ? ('paused' as const) : ('asleep' as const),
        timer: formatClockDuration(asleep),
        pauseTimer: open ? formatClockDuration(elapsedMs(open.startedAt, Date.now(), offset)) : null,
        caption: open ? 'На паузі' : sleep.active.kind === 'NIGHT' ? 'Нічний сон' : 'Денний сон',
      };
    }
    if (sleep.awakeSince) {
      return {
        mode: 'awake' as const,
        timer: formatClockDuration(elapsedMs(sleep.awakeSince, Date.now(), offset)),
        pauseTimer: null,
        caption: 'Не спить',
      };
    }
    return {mode: 'empty' as const, timer: '—', pauseTimer: null, caption: 'Ще немає запису'};
  });

  readonly spoken = computed(() => {
    this.minuteTick();
    const sleep = this.snapshot();
    if (!sleep) return '';
    if (!sleep.active) return sleep.headline;
    const pauses = sleep.active.pauses ?? [];
    const minutes = Math.floor(
      asleepMs(sleep.active.startedAt, null, pauses, Date.now(), this.clockOffset()) / 60000,
    );
    const open = pauses.some((pause) => pause.endedAt === null);
    return open
      ? `Сон на паузі. Вже проспала ${formatMinutes(minutes)}.`
      : `Соломія спить уже ${formatMinutes(minutes)}.`;
  });

  private readonly followServer = effect(() => {
    const status = this.data.overview.status();
    if (status !== 'resolved' && status !== 'reloading' && status !== 'local') return;
    const overview = this.data.overview.value() as SleepOverview;
    untracked(() => this.applyOverview(overview));
  });

  constructor() {
    const timer = setInterval(() => {
      this.tick.update((value) => value + 1);
      const minute = Math.floor(Date.now() / SLEEP_UI.minuteMs);
      if (minute !== this.lastMinute) {
        this.lastMinute = minute;
        this.minuteTick.set(minute);
      }
    }, SLEEP_UI.tickMs);
    const poll = setInterval(() => this.data.overview.reload(), SLEEP_UI.pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') this.data.overview.reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  chooseKind(kind: SleepKind): void {
    this.kindTouched = true;
    this.kind.set(kind);
  }

  onBirthInput(value: string): void {
    this.birthEdited = true;
    this.birthDate.set(value);
  }

  barHeight(day: WeekDay): number {
    if (day.targetMin <= 0 || day.sleepMin <= 0) return 0;
    return Math.min(100, (day.sleepMin / day.targetMin) * 100);
  }

  start(): void {
    const raw = this.backdate();
    const startedAt = raw ? new Date(raw) : null;
    if (startedAt && !Number.isFinite(startedAt.getTime())) {
      this.error.set('Час початку некоректний.');
      return;
    }
    this.busy.set(true);
    this.data.start({
      kind: this.kind(),
      startedAt: startedAt?.toISOString(),
    }).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.backdate.set('');
        this.error.set('');
        this.notice.set(
          result.resumed
            ? 'Сон уже йшов. Таймер лишився з початкового часу.'
            : 'Сон розпочато. Час збережено для всієї родини.',
        );
      },
      error: (error: unknown) => this.fail(error, 'Не вдалося почати сон.'),
    });
  }

  stop(endedAtRaw?: string): void {
    const endedAt = endedAtRaw ? new Date(endedAtRaw) : null;
    if (endedAt && !Number.isFinite(endedAt.getTime())) {
      this.error.set('Час пробудження некоректний.');
      return;
    }
    this.busy.set(true);
    this.data.stop({endedAt: endedAt?.toISOString()}).subscribe({
      next: () => {
        this.busy.set(false);
        this.wakeAt.set('');
        this.error.set('');
        this.notice.set('Сон завершено.');
      },
      error: (error: unknown) => this.fail(error, 'Не вдалося завершити сон.'),
    });
  }

  pause(): void {
    this.busy.set(true);
    this.data.pause().subscribe({
      next: (result) => {
        this.busy.set(false);
        this.error.set('');
        this.notice.set(result.alreadyPaused ? 'Пауза вже йде.' : 'Сон на паузі. Лічильник сну зупинено.');
      },
      error: (error: unknown) => this.fail(error, 'Не вдалося поставити паузу.'),
    });
  }

  resume(): void {
    this.busy.set(true);
    this.data.resume().subscribe({
      next: () => {
        this.busy.set(false);
        this.adjust.set(null);
        this.error.set('');
        this.notice.set('Сон продовжено.');
      },
      error: (error: unknown) => this.fail(error, 'Не вдалося продовжити сон.'),
    });
  }

  openStartAdjust(): void {
    const active = this.snapshot()?.active;
    if (!active) return;
    this.adjust.set('start');
    this.adjustTime.set(toLocalDateTime(active.startedAt));
    this.error.set('');
  }

  openPauseAdjust(pause: SleepPause): void {
    this.editingPauseId.set(pause.id);
    this.pauseClosed.set(pause.endedAt !== null);
    this.adjust.set('pause');
    this.adjustTime.set(toLocalDateTime(pause.startedAt));
    this.pauseEndTime.set(pause.endedAt ? toLocalDateTime(pause.endedAt) : '');
    this.error.set('');
  }

  closeAdjust(): void {
    this.adjust.set(null);
    this.editingPauseId.set(null);
  }

  saveAdjust(): void {
    const active = this.snapshot()?.active;
    const when = new Date(this.adjustTime());
    if (!active || !Number.isFinite(when.getTime())) {
      this.error.set('Час некоректний.');
      return;
    }
    this.busy.set(true);
    if (this.adjust() === 'start') {
      this.data.update(active.id, {startedAt: when.toISOString()}).subscribe({
        next: () => this.adjusted('Початок сну оновлено.'),
        error: (error: unknown) => this.fail(error, 'Не вдалося змінити початок.'),
      });
      return;
    }
    const pauseId = this.editingPauseId();
    const original = active.pauses.find((pause) => pause.id === pauseId);
    if (!pauseId || !original) {
      this.busy.set(false);
      return;
    }
    const endRaw = this.pauseEndTime();
    const ended = endRaw ? new Date(endRaw) : null;
    if (original.endedAt && (!ended || !Number.isFinite(ended.getTime()))) {
      this.busy.set(false);
      this.error.set('Вкажіть кінець паузи.');
      return;
    }
    this.data.updatePause(pauseId, {
      startedAt: when.toISOString(),
      endedAt: original.endedAt ? ended?.toISOString() : undefined,
    }).subscribe({
      next: () => this.adjusted('Паузу оновлено.'),
      error: (error: unknown) => this.fail(error, 'Не вдалося змінити паузу.'),
    });
  }

  private adjusted(message: string): void {
    this.busy.set(false);
    this.adjust.set(null);
    this.editingPauseId.set(null);
    this.error.set('');
    this.notice.set(message);
  }

  openCreate(): void {
    const now = new Date();
    const start = new Date(now.getTime() - SLEEP_UI.defaultEditLookbackMs);
    this.editingId.set(null);
    this.model.set({
      kind: this.kind(),
      startedAt: toLocalDateTime(start.toISOString()),
      endedAt: toLocalDateTime(now.toISOString()),
      notes: '',
    });
    this.error.set('');
    this.formOpen.set(true);
  }

  edit(session: SleepSession): void {
    this.editingId.set(session.id);
    this.model.set({
      kind: session.kind,
      startedAt: toLocalDateTime(session.startedAt),
      endedAt: session.endedAt ? toLocalDateTime(session.endedAt) : '',
      notes: session.notes ?? '',
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
    const startedAt = new Date(value.startedAt);
    const endedAt = value.endedAt ? new Date(value.endedAt) : null;
    const editing = this.snapshot()?.sessions.find((session) => session.id === this.editingId()) ?? null;
    if (!Number.isFinite(startedAt.getTime()) || (endedAt && !Number.isFinite(endedAt.getTime()))) {
      this.error.set('Перевірте час початку і завершення.');
      return;
    }
    if (!endedAt && (!editing || editing.endedAt)) {
      this.error.set('Вкажіть, коли сон закінчився.');
      return;
    }
    const payload: SleepPayload = {
      kind: value.kind,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt ? endedAt.toISOString() : null,
      notes: value.notes.trim() || null,
    };
    this.busy.set(true);
    const id = this.editingId();
    const request = id ? this.data.update(id, payload) : this.data.create(payload);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(id ? 'Запис оновлено.' : 'Сон додано.');
        this.cancel();
      },
      error: (error: unknown) => this.fail(error, 'Не вдалося зберегти сон.'),
    });
  }

  remove(id: string): void {
    this.busy.set(true);
    this.data.remove(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deletingId.set(null);
        this.notice.set('Запис видалено.');
      },
      error: (error: unknown) => this.fail(error, 'Не вдалося видалити запис.'),
    });
  }

  readonly napChoices = [3, 4] as const;

  setNaps(count: number): void {
    if (this.snapshot()?.napTarget === count) return;
    this.busy.set(true);
    this.data.saveProfile({ napTarget: count }).subscribe({
      next: () => {
        this.busy.set(false);
        this.error.set('');
        this.notice.set(count === 3 ? 'План на 3 денні сни.' : 'План на 4 денні сни.');
      },
      error: (error: unknown) => this.fail(error, 'Не вдалося зберегти кількість снів.'),
    });
  }

  saveBirth(): void {
    const value = this.birthDate().trim();
    this.busy.set(true);
    this.data.saveProfile({ birthDate: value || null }).subscribe({
      next: () => {
        this.busy.set(false);
        this.birthEdited = false;
        this.error.set('');
        this.notice.set(value ? 'Дату народження збережено.' : 'Вік знову рахується як 4 місяці.');
      },
      error: (error: unknown) => this.fail(error, 'Не вдалося зберегти дату.'),
    });
  }

  private applyOverview(overview: SleepOverview): void {
    const active = overview.active
      ? { ...overview.active, pauses: overview.active.pauses ?? [] }
      : null;
    this.snapshot.set({
      ...overview,
      active,
      sessions: overview.sessions.map((session) => ({ ...session, pauses: session.pauses ?? [] })),
    });
    this.clockOffset.set(new Date(overview.serverNow).getTime() - Date.now());
    const activeId = overview.active?.id ?? null;
    if (activeId !== this.lastActiveId) {
      this.kindTouched = false;
      this.lastActiveId = activeId;
    }
    if (!this.kindTouched) this.kind.set(overview.suggestedKind);
    if (!this.birthEdited) this.birthDate.set(overview.profile.birthDate ?? '');
  }

  private fail(error: unknown, fallback: string): void {
    this.busy.set(false);
    this.error.set(readError(error, fallback));
    this.data.overview.reload();
  }
}

function readError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'error' in error) {
    const body = (error as { error?: { message?: unknown } }).error;
    if (typeof body?.message === 'string') return body.message;
    if (Array.isArray(body?.message) && body.message.every((item) => typeof item === 'string')) {
      return body.message.join(' ');
    }
  }
  return fallback;
}
