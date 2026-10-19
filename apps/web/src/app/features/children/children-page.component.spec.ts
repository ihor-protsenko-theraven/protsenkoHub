import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {ChildrenPage} from './children-page.component';
import {ChildrenService} from './children.service';

describe('ChildrenPage', () => {
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
