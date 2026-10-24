import {DatePipe, NgTemplateOutlet} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import {form, FormField, required} from '@angular/forms/signals';
import {RouterLink} from '@angular/router';
import {APP_LOCALE} from '../../core/configs/locale.config';
import {HistoryPanel} from '../../shared/history-panel.component';
import {toLocalDateTime} from '../../shared/date-time.util';
import {asleepMs, formatMinutes} from './sleep-clock';
import {SLEEP_UI} from './sleep.config';
import {isCurrentDaySession} from './sleep-day';
import {readSleepError} from './sleep-error.util';
import {sleepKindLabel} from './sleep-kind.util';
import {SavedPauseForm, SleepForm, SleepKind, SleepOverview, SleepPause, SleepPayload, SleepSession, WeekDay,} from './sleep.model';
import {normalizeSleepOverview} from './sleep-overview.util';
import {SleepService} from './sleep.service';
import {SleepReminderService} from './sleep-reminder.service';
import {SleepStatus} from './sleep-status.component';
import {SleepTickerService} from './sleep-ticker.service';
import {SleepTimer} from './sleep-timer.component';

const emptyForm = (): SleepForm => ({kind: 'NAP', startedAt: '', endedAt: '', notes: ''});
const dayCount = new Intl.NumberFormat(APP_LOCALE, {style: 'unit', unit: 'day', unitDisplay: 'long'});

@Component({
  selector: 'app-sleep-page',
  imports: [DatePipe, FormField, HistoryPanel, NgTemplateOutlet, RouterLink, SleepStatus, SleepTimer],
  providers: [SleepService, SleepReminderService, SleepTickerService],
  templateUrl: './sleep.page.html',
  styleUrl: './sleep.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SleepPage {
  readonly data = inject(SleepService);
  readonly reminders = inject(SleepReminderService);
  private readonly ticker = inject(SleepTickerService);
  private readonly destroyRef = inject(DestroyRef);
  readonly kindLabel = sleepKindLabel;
  readonly minutes = formatMinutes;
  readonly snapshot = linkedSignal<SleepOverview | null, SleepOverview | null>({
    source: () => this.data.overview.hasValue() ? this.data.overview.value() : null,
    computation: (overview, previous) => overview
      ? normalizeSleepOverview(overview)
      : previous?.value ?? null,
  });
  readonly clockOffset = computed(() => {
    const serverNow = this.snapshot()?.serverNow;
    return serverNow ? new Date(serverNow).getTime() - Date.now() : 0;
  });
  readonly kind = linkedSignal<{ activeId: string | null; suggested: SleepKind }, SleepKind>({
    source: () => ({
      activeId: this.snapshot()?.active?.id ?? null,
      suggested: this.snapshot()?.suggestedKind ?? 'NAP',
    }),
    computation: (source, previous) =>
      previous?.source.activeId === source.activeId && previous.source.suggested === source.suggested
        ? previous.value
        : source.suggested,
  });
  readonly backdate = signal('');
  readonly wakeAt = signal('');
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
  readonly savedPauseSessionId = signal<string | null>(null);
  readonly savedPauseId = signal<string | null>(null);
  readonly savedPauseModel = signal<SavedPauseForm>({startedAt: '', endedAt: ''});
  readonly savedPauseForm = form(this.savedPauseModel, (path) => {
    required(path.startedAt);
    required(path.endedAt);
  });

  readonly tracker = computed(() => {
    const sleep = this.snapshot();
    if (!sleep?.active) return null;
    const open = (sleep.active.pauses ?? []).find((pause) => pause.endedAt === null) ?? null;
    if (open) return {kind: 'paused' as const, caption: 'На паузі', pauseStartedAt: open.startedAt};
    return {
      kind: 'asleep' as const,
      caption: sleep.active.kind === 'NIGHT' ? 'Нічний сон' : 'Денний сон',
      pauseStartedAt: null as string | null,
    };
  });

  readonly todayLabel = computed(() => {
    this.ticker.minute();
    const sleep = this.snapshot();
    if (!sleep) return '';
    return new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone: sleep.timeZone,
      day: 'numeric',
      month: 'long',
    }).format(new Date());
  });

  readonly historyLabel = computed(() =>
    `Історія за ${dayCount.format(this.snapshot()?.historyDays ?? SLEEP_UI.historyDays)}`,
  );

  readonly sessionsByDay = computed(() => {
    this.ticker.minute();
    const sleep = this.snapshot();
    const today: SleepSession[] = [];
    const earlier: SleepSession[] = [];
    if (!sleep) return {today, earlier};
    for (const session of sleep.sessions) {
      if (isCurrentDaySession(session, sleep.timeZone)) today.push(session);
      else earlier.push(session);
    }
    return {today, earlier};
  });

  constructor() {
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') this.data.overview.reload();
    }, SLEEP_UI.pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') this.data.overview.reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  chooseKind(kind: SleepKind): void {
    this.kind.set(kind);
  }

  barHeight(day: WeekDay): number {
    if (day.targetMin <= 0 || day.sleepMin <= 0) return 0;
    return Math.min(100, (day.sleepMin / day.targetMin) * 100);
  }

  historyDuration(session: SleepSession): string {
    const durationMs = asleepMs(
      session.startedAt,
      session.endedAt,
      session.pauses,
      Date.now(),
      this.clockOffset(),
    );
    return formatMinutes(Math.floor(durationMs / SLEEP_UI.minuteMs));
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

  openSavedPause(session: SleepSession, pause?: SleepPause): void {
    this.savedPauseSessionId.set(session.id);
    this.savedPauseId.set(pause?.id ?? null);
    this.savedPauseModel.set({
      startedAt: pause ? toLocalDateTime(pause.startedAt) : '',
      endedAt: pause?.endedAt ? toLocalDateTime(pause.endedAt) : '',
    });
    this.error.set('');
  }

  closeSavedPause(): void {
    this.savedPauseSessionId.set(null);
    this.savedPauseId.set(null);
    this.error.set('');
  }

  saveSavedPause(): void {
    const sessionId = this.savedPauseSessionId();
    if (!sessionId) return;
    const overview = this.snapshot();
    const session = overview?.active?.id === sessionId
      ? overview.active
      : overview?.sessions.find((item) => item.id === sessionId);
    if (!session) {
      this.error.set('Запис сну вже недоступний. Оновіть сторінку.');
      return;
    }
    const value = this.savedPauseModel();
    const startedAt = new Date(value.startedAt);
    const endedAt = new Date(value.endedAt);
    if (!value.startedAt || !value.endedAt || !Number.isFinite(startedAt.getTime()) ||
        !Number.isFinite(endedAt.getTime()) || endedAt <= startedAt) {
      this.error.set('Вкажіть коректні початок і кінець паузи.');
      return;
    }
    if (startedAt < new Date(session.startedAt) ||
        endedAt > new Date(session.endedAt ?? Date.now())) {
      this.error.set('Пауза має бути всередині сну та вже завершитися.');
      return;
    }
    const payload = {startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString()};
    const pauseId = this.savedPauseId();
    this.busy.set(true);
    const request = pauseId
      ? this.data.updatePause(pauseId, payload)
      : this.data.createSavedPause(sessionId, payload);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(pauseId ? 'Паузу оновлено.' : 'Паузу додано.');
        this.closeSavedPause();
      },
      error: (error: unknown) => this.fail(error, 'Не вдалося зберегти паузу.'),
    });
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

  readonly napChoices = SLEEP_UI.napChoices;

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

  private fail(error: unknown, fallback: string): void {
    this.busy.set(false);
    this.error.set(readSleepError(error, fallback));
    this.data.overview.reload();
  }
}
