import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {ChildrenPage} from './children-page.component';
import {ChildrenService} from './children.service';

describe('ChildrenPage', () => {
  it('shows a retry action when the initial task request fails', async () => {
    const reload = vi.fn();
    TestBed.configureTestingModule({
      imports: [ChildrenPage],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(ChildrenPage, {
      set: {
        providers: [{
          provide: ChildrenService,
          useValue: {
            tasks: {
              hasValue: () => false,
              isLoading: () => false,
              error: () => new Error('Request failed'),
              value: () => { throw new Error('ResourceValueError'); },
              reload,
            },
          },
        }],
      },
    });

    const fixture = TestBed.createComponent(ChildrenPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Не вдалося завантажити');
    const retry = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Повторити');
    expect(retry).toBeTruthy();
    retry?.click();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('names the section Діти and chooses a labeled priority while creating a task', async () => {
    TestBed.configureTestingModule({
      imports: [ChildrenPage],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(ChildrenPage, {
      set: {
        providers: [{
          provide: ChildrenService,
          useValue: {
            tasks: {
              hasValue: () => true,
              isLoading: () => false,
              error: () => undefined,
              value: () => [],
              reload: () => undefined,
            },
            create: () => of(null),
            update: () => of(null),
            remove: () => of(null),
          },
        }],
      },
    });
    const fixture = TestBed.createComponent(ChildrenPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#page-title')?.textContent).toBe('Діти');
    expect(host.textContent).not.toContain('Соломія');

    host.querySelectorAll('button').item(1).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const choices = host.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect(Array.from(choices, (button) => button.textContent?.trim())).toEqual([
      'Звичайний',
      'Важливо',
      'Терміново',
    ]);
    expect(choices[0].getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('input[type="number"]')).toBeNull();

    choices[2].click();
    fixture.detectChanges();
    expect(choices[2].getAttribute('aria-checked')).toBe('true');
    expect(choices[0].getAttribute('aria-checked')).toBe('false');
  });
});
