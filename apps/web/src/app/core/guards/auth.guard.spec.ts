import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

const route = {} as Parameters<typeof authGuard>[0];
const state = {} as Parameters<typeof authGuard>[1];

describe('session route guards', () => {
  it('restores an existing cookie session before opening a protected route', async () => {
    const auth = {
      user: () => null,
      ready: () => false,
      bootstrap: vi.fn(() => of({ user: {} })),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));
    expect(await firstValueFrom(result as Observable<boolean>)).toBe(true);
    expect(auth.bootstrap).toHaveBeenCalledOnce();
  });

  it('redirects to login when session restoration fails', async () => {
    const auth = {
      user: () => null,
      ready: () => false,
      bootstrap: () => throwError(() => new Error('Unauthorized')),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));
    const decision = await firstValueFrom(result as Observable<UrlTree>);
    expect(TestBed.inject(Router).serializeUrl(decision)).toBe('/login');
  });

  it('redirects a signed-in visitor away from login', () => {
    const auth = { user: () => ({ userId: 'user' }) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });

    const decision = TestBed.runInInjectionContext(() => guestGuard(route, state));
    expect(TestBed.inject(Router).serializeUrl(decision as UrlTree)).toBe('/app/calendar');
  });
});
