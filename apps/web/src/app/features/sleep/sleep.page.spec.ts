import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SleepPage } from './sleep.page';
import { SleepReminderService } from './sleep-reminder.service';
import { SleepService } from './sleep.service';
import { SleepTickerService } from './sleep-ticker.service';

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
          { provide: SleepService, useValue: { overview: {
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
});
