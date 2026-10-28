import { registerLocaleData } from '@angular/common';
import localeUk from '@angular/common/locales/uk';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { toLocalDateTime } from '../../shared/date-time.util';
import type { SleepOverview, SleepSession } from './sleep.model';
import { SleepPage } from './sleep.page';
import { SleepReminderService } from './sleep-reminder.service';
import { SleepService } from './sleep.service';
import { SleepTickerService } from './sleep-ticker.service';

registerLocaleData(localeUk);

describe('SleepPage', () => {
  it('waits for an overview value while retrying the first failed load', async () => {
    const status = signal<'error' | 'reloading'>('error');
    const error = signal<Error | undefined>(new Error('Request failed'));
    const reload = vi.fn();

    TestBed.configureTestingModule({ imports: [SleepPage] });
    TestBed.overrideComponent(SleepPage, {
      set: {
        providers: [
          SleepTickerService,
          { provide: SleepService, useValue: { widgetSyncError: signal(''), syncWidget: vi.fn(), overview: {
            status, error, hasValue: () => false, value: () => undefined, reload,
          } } },
          { provide: SleepReminderService, useValue: {} },
        ],
      },
    });

    const fixture = TestBed.createComponent(SleepPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Не вдалося завантажити сон');

    status.set('reloading');
    error.set(undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Завантажуємо трекер');
    expect(reload).not.toHaveBeenCalled();
  });

  it('adds a past pause to the active sleep from the page', async () => {
    const now = Date.now();
    const active: SleepSession = {
      id: 'sleep-1', kind: 'NIGHT', startedAt: new Date(now - 7 * 3_600_000).toISOString(),
      endedAt: null, notes: null, startedByName: null, endedByName: null,
      updatedByName: null, pauses: [],
    };
    const overview: SleepOverview = {
      serverNow: new Date(now).toISOString(), timeZone: 'Europe/Kyiv', historyDays: 7,
      profile: { babyName: 'Дитина', birthDate: null, ageWeeks: null, ageLabel: null,
        napTarget: 3, updatedByName: null },
      active, sessions: [], headline: '', detail: '', nextSleepAt: null, prepareAt: null,
      expectedWakeAt: null, wakeWindowMin: null, lifeWeek: null, weekNote: null,
      napTarget: 3, basis: '', signals: [], schedule: [], scheduleNote: null,
      howItWorks: [], disclaimer: '', suggestedKind: 'NIGHT', activeStale: false,
      awakeSince: null, todayBlocks: [], week: [],
      stats: { todaySleepMin: 0, todayNapCount: 0, todayNapMin: 0, todayNightMin: 0,
        last24hSleepMin: 0, targetSleepMin: 0, sleepDebtMin: 0, weekAvgSleepMin: null,
        weekAvgNapCount: null, bedtimeClock: null, wakeClock: null,
        bedtimeSpreadMin: null, longestStretchMin: 0 },
    };
    const createSavedPause = vi.fn().mockReturnValue(of({ session: active }));
    const reload = vi.fn();

    TestBed.configureTestingModule({ imports: [SleepPage], providers: [provideRouter([])] });
    TestBed.overrideComponent(SleepPage, {
      set: {
        providers: [
          SleepTickerService,
          { provide: SleepService, useValue: { widgetSyncError: signal(''), syncWidget: vi.fn(), overview: {
            hasValue: () => true, value: () => overview, reload,
          }, createSavedPause } },
          { provide: SleepReminderService, useValue: {
            supported: () => false, enabled: () => false, busy: () => false,
            available: () => false, config: { error: () => undefined, isLoading: () => false },
          } },
        ],
      },
    });

    const fixture = TestBed.createComponent(SleepPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const add = [...root.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Додати минулу паузу');
    expect(add).toBeTruthy();
    add?.click();
    await fixture.whenStable();

    const fields = root.querySelectorAll<HTMLInputElement>('.sleep-hero .saved-pause-form input');
    expect(fields).toHaveLength(2);
    fields[0]!.value = toLocalDateTime(new Date(now - 8 * 3_600_000).toISOString());
    fields[0]!.dispatchEvent(new Event('input', { bubbles: true }));
    fields[1]!.value = toLocalDateTime(new Date(now - 2 * 3_600_000).toISOString());
    fields[1]!.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    root.querySelector<HTMLFormElement>('.sleep-hero .saved-pause-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(root.textContent).toContain('Пауза має бути всередині сну');
    expect(createSavedPause).not.toHaveBeenCalled();

    fields[0]!.value = toLocalDateTime(new Date(now - 3 * 3_600_000).toISOString());
    fields[0]!.dispatchEvent(new Event('input', { bubbles: true }));
    fields[1]!.value = toLocalDateTime(new Date(now - 2 * 3_600_000).toISOString());
    fields[1]!.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    root.querySelector<HTMLFormElement>('.sleep-hero .saved-pause-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(createSavedPause).toHaveBeenCalledWith('sleep-1', {
      startedAt: new Date(fields[0]!.value).toISOString(),
      endedAt: new Date(fields[1]!.value).toISOString(),
    });
    expect(root.textContent).toContain('Паузу додано.');
    expect(root.querySelector('.sleep-hero .saved-pause-form')).toBeNull();
  });
});
