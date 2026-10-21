import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, take, tap, timeout } from 'rxjs';
import { SwPush } from '@angular/service-worker';
import { API_BASE_URL } from '../configs/api.config';
import { readPushSubscription } from '../push-subscription';
import { EXPECTED_GUEST_SESSION } from '../toast/api-error.interceptor';
import { AuthUser, RegisterModel } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly push = inject(SwPush);

  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);

  bootstrap(): Observable<{ user: AuthUser }> {
    return this.http
      .get<{ user: AuthUser }>(`${API_BASE_URL}/auth/me`, {
        withCredentials: true,
        context: new HttpContext().set(EXPECTED_GUEST_SESSION, true),
      })
      .pipe(
        tap({
          next: (res) => {
            this.user.set(res.user);
            this.ready.set(true);
          },
          error: () => {
            this.user.set(null);
            this.ready.set(true);
          },
        }),
      );
  }

  login(email: string, password: string): Observable<{ user: AuthUser }> {
    return this.http
      .post<{ user: AuthUser }>(
        `${API_BASE_URL}/auth/login`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(tap((res) => this.user.set(res.user)));
  }

  register(payload: RegisterModel): Observable<{ user: AuthUser }> {
    return this.http
      .post<{ user: AuthUser }>(`${API_BASE_URL}/auth/register`, payload, {
        withCredentials: true,
      })
      .pipe(tap((res) => this.user.set(res.user)));
  }

  setUser(user: AuthUser): void {
    this.user.set(user);
    this.ready.set(true);
  }

  logout(): void {
    void this.logoutAndClearPush();
  }

  private async logoutAndClearPush(): Promise<void> {
    if (this.push.isEnabled) {
      try {
        let subscription: PushSubscription | null = null;
        try {
          subscription = await firstValueFrom(this.push.subscription.pipe(take(1), timeout(3000)));
        } catch {
          subscription = null;
        }
        subscription ??= await readPushSubscription();
        if (subscription) {
          await Promise.allSettled([
            firstValueFrom(this.http.post(
              `${API_BASE_URL}/sleep-reminders/unsubscribe`,
              { endpoint: subscription.endpoint },
              { withCredentials: true },
            ).pipe(timeout(3000))),
            this.push.unsubscribe(),
          ]);
        }
      } catch {
        // Logout still completes if push permissions or network are unavailable.
      }
    }
    this.http
      .post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
      .subscribe({
        next: () => {
          this.user.set(null);
          void this.router.navigateByUrl('/login');
        },
        error: () => {
          this.user.set(null);
          void this.router.navigateByUrl('/login');
        },
      });
  }
}
