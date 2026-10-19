import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { AuthUser, RegisterModel } from './auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);

  bootstrap(): Observable<{ user: AuthUser }> {
    return this.http
      .get<{ user: AuthUser }>(`${API_BASE_URL}/auth/me`, {
        withCredentials: true,
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

  logout(): void {
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
