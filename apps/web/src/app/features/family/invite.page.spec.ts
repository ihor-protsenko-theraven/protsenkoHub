import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { InvitationService } from './invitation.service';
import { InvitePage } from './invite.page';

describe('InvitePage preview', () => {
  const invitation = {
    email: 'guest@example.test',
    householdName: 'Родина',
    expiresAt: '2026-10-27T10:00:00.000Z',
  };

  function createPage(preview: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [InvitePage],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: 'invite-token' }) } } },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: AuthService, useValue: { ready: () => true, user: () => null } },
      ],
    });
    TestBed.overrideComponent(InvitePage, {
      set: { providers: [{ provide: InvitationService, useValue: { preview } }] },
    });
    const fixture = TestBed.createComponent(InvitePage);
    fixture.detectChanges();
    return fixture;
  }

  it('offers retry after a connection failure and loads the preview on retry', async () => {
    const preview = vi.fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of(invitation));
    const fixture = createPage(preview);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Немає зв’язку з сервером');
    expect(host.textContent).not.toContain('Запрошення недійсне');
    const retry = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Повторити');
    expect(retry).toBeTruthy();

    retry?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(preview).toHaveBeenCalledTimes(2);
    expect(preview).toHaveBeenCalledWith('invite-token');
    expect(host.textContent).toContain('Вас запрошено до родини');
    expect(host.textContent).not.toContain('Немає зв’язку з сервером');
  });

  it.each([400, 404, 410])('shows an invalid invitation without retry for HTTP %s', async (status) => {
    const preview = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const fixture = createPage(preview);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Запрошення недійсне або термін його дії минув.');
    expect(Array.from(host.querySelectorAll('button')).some((button) => button.textContent?.trim() === 'Повторити')).toBe(false);
  });
});
