import {registerLocaleData} from '@angular/common';
import localeUk from '@angular/common/locales/uk';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {describe, expect, it, vi} from 'vitest';
import {MeasurementsPage} from './measurements.page';
import {MeasurementsService} from './measurements.service';
import {MeasurementsFeed} from './measurements.model';

registerLocaleData(localeUk);

const testFeed: MeasurementsFeed = {
  child: {
    id: 'child-1',
    name: 'Соломія',
    birthDate: '2026-01-01',
  },
  measurements: [
    {
      id: 'meas-2',
      childId: 'child-1',
      measuredAt: '2026-07-01T08:00:00.000Z',
      weightKg: 8.5,
      heightCm: 71,
      headCircumferenceCm: 44,
      notes: 'Візит до лікаря',
      createdByName: 'Мама',
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-01T08:00:00.000Z',
    },
    {
      id: 'meas-1',
      childId: 'child-1',
      measuredAt: '2026-06-01T08:00:00.000Z',
      weightKg: 8.0,
      heightCm: 69.5,
      headCircumferenceCm: 43,
      notes: null,
      createdByName: 'Тато',
      createdAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-06-01T08:00:00.000Z',
    },
  ],
};

function createMockResource<T>(value: T, fail = false) {
  const reload = vi.fn();
  return {
    status: () => (fail ? 'error' : 'resolved'),
    hasValue: () => !fail,
    isLoading: () => false,
    error: () => (fail ? new Error('Load failed') : undefined),
    value: () => {
      if (fail) throw new Error('ResourceValueError');
      return value;
    },
    reload,
  };
}

describe('MeasurementsPage', () => {
  let createSpy: ReturnType<typeof vi.fn>;
  let updateSpy: ReturnType<typeof vi.fn>;
  let removeSpy: ReturnType<typeof vi.fn>;

  function setup(feed: MeasurementsFeed = testFeed, fail = false) {
    createSpy = vi.fn(() => of({id: 'meas-new', childId: 'child-1'}));
    updateSpy = vi.fn(() => of({id: 'meas-2', childId: 'child-1'}));
    removeSpy = vi.fn(() => of(undefined));

    TestBed.configureTestingModule({
      imports: [MeasurementsPage],
      providers: [provideRouter([])],
    });

    TestBed.overrideComponent(MeasurementsPage, {
      set: {
        providers: [
          {
            provide: MeasurementsService,
            useValue: {
              feed: createMockResource(feed, fail),
              create: createSpy,
              update: updateSpy,
              remove: removeSpy,
            },
          },
        ],
      },
    });

    const fixture = TestBed.createComponent(MeasurementsPage);
    fixture.detectChanges();
    return {fixture};
  }

  it('renders title, summary KPI cards and measurement list with deltas', async () => {
    const {fixture} = setup();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('#page-title')?.textContent).toBe('Вимірювання');
    expect(host.textContent).toContain('Соломія');
    expect(host.textContent).toContain('8,5 кг');
    expect(host.textContent).toContain('+500 г');
    expect(host.textContent).toContain('71 см');
    expect(host.textContent).toContain('+1,5 см');
    expect(host.textContent).toContain('44 см');
    expect(host.textContent).toContain('+1 см');
    expect(host.textContent).toContain('Візит до лікаря');
  });

  it('renders empty state when there are no measurements', async () => {
    const emptyFeed: MeasurementsFeed = {
      child: {id: 'child-1', name: 'Малюк', birthDate: null},
      measurements: [],
    };
    const {fixture} = setup(emptyFeed);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Ще немає записів вимірювань');
  });

  it('opens new measurement form and saves new entry', async () => {
    const {fixture} = setup();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.createNew();
    fixture.detectChanges();

    expect(component.formOpen()).toBe(true);

    component.model.set({
      measuredAt: '2026-08-01',
      weightKg: '9.1',
      heightCm: '73.0',
      headCircumferenceCm: '44.5',
      notes: '8 місяців',
    });

    component.save();
    fixture.detectChanges();

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        weightKg: 9.1,
        heightCm: 73.0,
        headCircumferenceCm: 44.5,
        notes: '8 місяців',
      }),
    );
    expect(component.formOpen()).toBe(false);
  });

  it('shows error if saving without any metric', async () => {
    const {fixture} = setup();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.createNew();
    component.model.set({
      measuredAt: '2026-08-01',
      weightKg: '',
      heightCm: '',
      headCircumferenceCm: '',
      notes: '',
    });

    component.save();
    fixture.detectChanges();

    expect(createSpy).not.toHaveBeenCalled();
    expect(component.error()).toContain('Вкажіть хоча б один показник');
  });

  it('deletes measurement after confirmation', async () => {
    const {fixture} = setup();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.confirmDelete('meas-2');
    expect(component.deletingId()).toBe('meas-2');

    component.deleteConfirmed('meas-2');
    expect(removeSpy).toHaveBeenCalledWith('meas-2');
  });
});
