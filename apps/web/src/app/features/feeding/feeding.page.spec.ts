import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FeedingPage } from './feeding.page';
import { FeedingService } from './feeding.service';
import { FeedingTracker, FoodCategoryGroup } from './feeding.model';

const dictionary: FoodCategoryGroup[] = [
  {
    id: 'cat-vegetables',
    name: 'Овочі',
    items: [
      {
        id: 'food-zucchini',
        categoryId: 'cat-vegetables',
        name: 'Кабачок',
        allowedFromAgeMonths: 6,
        preparationGuide: 'На парі.',
        isAllergen: false,
      },
    ],
  },
];

const tracker: FeedingTracker = {
  child: { id: 'child-1', name: 'Дитина', birthDate: '2025-04-28', ageMonths: 18 },
  records: [],
};

describe('FeedingPage', () => {
  function setup(options: { fail?: boolean; child?: FeedingTracker['child'] } = {}) {
    const reloadDictionary = vi.fn();
    const reloadRecords = vi.fn();
    const upsert = vi.fn(() => of(null));
    const records = options.child === undefined ? tracker : { ...tracker, child: options.child };
    TestBed.configureTestingModule({
      imports: [FeedingPage],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(FeedingPage, {
      set: {
        providers: [{
          provide: FeedingService,
          useValue: {
            dictionary: resource(options.fail ? undefined : dictionary, options.fail ?? false, reloadDictionary),
            records: resource(options.fail ? undefined : records, options.fail ?? false, reloadRecords),
            upsert,
          },
        }],
      },
    });
    const fixture = TestBed.createComponent(FeedingPage);
    fixture.detectChanges();
    return { fixture, reloadDictionary, reloadRecords, upsert };
  }

  it('shows the guide and saves a tracker status for the child', async () => {
    const { fixture, upsert } = setup();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#page-title')?.textContent).toBe('Прикорм');
    expect(host.textContent).toContain('Кабачок');
    expect(host.textContent).toContain('з 6 місяців');
    expect(host.textContent).toContain('Поради');
    expect(host.textContent).toContain('Як готувати');
    expect(host.textContent).toContain('На парі.');

    host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    const introduced = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Введено');
    introduced?.click();
    fixture.detectChanges();
    expect(upsert).toHaveBeenCalledWith('food-zucchini', { status: 'INTRODUCED', notes: null });
  });

  it('asks for a child profile before tracking', async () => {
    const { fixture } = setup({ child: null });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.textContent).toContain('Спочатку додайте дитину');
    expect(host.querySelector('a[href="/app/family"]')).not.toBeNull();
  });

  it('shows a retry action when feeding data fails to load', async () => {
    const { fixture, reloadDictionary, reloadRecords } = setup({ fail: true });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Не вдалося завантажити');
    const retry = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Повторити');
    retry?.click();
    expect(reloadDictionary).toHaveBeenCalledOnce();
    expect(reloadRecords).toHaveBeenCalledOnce();
  });
});

function resource<T>(value: T | undefined, fail: boolean, reload: ReturnType<typeof vi.fn>) {
  return {
    status: () => fail ? 'error' : 'resolved',
    hasValue: () => !fail,
    isLoading: () => false,
    error: () => fail ? new Error('Request failed') : undefined,
    value: () => {
      if (fail || value === undefined) throw new Error('ResourceValueError');
      return value;
    },
    reload,
  };
}
