import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { defer, firstValueFrom, from, map, Observable, switchMap, take, tap, timeout } from 'rxjs';
import { SwPush } from '@angular/service-worker';
import { App } from '@capacitor/app';
import { API_BASE_URL } from '../configs/api.config';
import { MOBILE_AUTH } from '../configs/mobile-auth.config';
import { isNativeApp } from '../configs/native-platform.config';
import { nativeDeepLinkRoute } from '../configs/native-deep-link';
import { MOBILE_API_ORIGIN_TOKEN, mobileApiUrl } from '../configs/mobile-api.config';
import { readPushSubscription } from '../push-subscription';
import { EXPECTED_GUEST_SESSION } from '../toast/api-error.interceptor';
import { AuthUser, RegisterModel } from '../models/auth.model';
import { MobileAuthResponse } from '../models/mobile-auth.model';
import { NATIVE_REFRESH_TOKEN_STORE } from './native-refresh-token';
import { SLEEP_WIDGET_BRIDGE } from '../../features/sleep/sleep-widget-bridge';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private readonly router = inject(Router);
  private readonly push = inject(SwPush);
  private readonly mobileApiOrigin = inject(MOBILE_API_ORIGIN_TOKEN);
  private readonly nativeRefreshTokens = inject(NATIVE_REFRESH_TOKEN_STORE);
  private readonly widget = inject(SLEEP_WIDGET_BRIDGE);
  private readonly destroyRef = inject(DestroyRef);
  private accessToken: string | null = null;
  private accessExpiresAt = 0;
  private refreshPromise: Promise<MobileAuthResponse | null> | null = null;
  private refreshTokenMutation: Promise<void> = Promise.resolve();
  private sessionVersion = 0;
  private nativeLoggingOut = false;
  private postLoginRoute: '/app/sleep' | null = null;

  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);

  constructor() {
    if (isNativeApp()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        if (this.user()) void this.syncNativeWidget();
        else if (this.ready()) void this.restoreNativeSession();
      }).catch(() => undefined);
      void App.addListener('appUrlOpen', ({ url }) => this.openNativeLink(url)).catch(() => undefined);
      void App.getLaunchUrl().then((launch) => {
        if (launch?.url) this.openNativeLink(launch.url);
      }).catch(() => undefined);
      const onOnline = () => {
        if (this.ready() && !this.user()) void this.restoreNativeSession();
      };
      window.addEventListener('online', onOnline);
      this.destroyRef.onDestroy(() => window.removeEventListener('online', onOnline));
    }
  }

  private openNativeLink(rawUrl: string): void {
    const route = nativeDeepLinkRoute(rawUrl);
    if (!route) return;
    this.postLoginRoute = this.user() ? null : route;
    if (this.router.url !== route) void this.router.navigateByUrl(route);
  }

  consumePostLoginRoute(): string {
    const route = this.postLoginRoute ?? '/app/home';
    this.postLoginRoute = null;
    return route;
  }

  bootstrap(): Observable<{ user: AuthUser }> {
    if (isNativeApp()) {
      return defer(() => from(this.refreshMobileSession())).pipe(
        map((response) => {
          if (!response) throw new Error('Мобільна сесія відсутня.');
          return { user: response.user };
        }),
        tap({
          next: ({ user }) => {
            this.user.set(user);
            this.ready.set(true);
            this.postLoginRoute = null;
            void this.syncNativeWidget();
          },
          error: () => {
            this.user.set(null);
            this.ready.set(true);
          },
        }),
      );
    }
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
    if (isNativeApp()) {
      return this.mobileLoginOrRegister(`${API_BASE_URL}/auth/mobile/login`, { email, password });
    }
    return this.http
      .post<{ user: AuthUser }>(
        `${API_BASE_URL}/auth/login`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(tap((res) => this.user.set(res.user)));
  }

  register(payload: RegisterModel): Observable<{ user: AuthUser }> {
    if (isNativeApp()) {
      return this.mobileLoginOrRegister(`${API_BASE_URL}/auth/mobile/register`, payload);
    }
    return this.http
      .post<{ user: AuthUser }>(`${API_BASE_URL}/auth/register`, payload, {
        withCredentials: true,
      })
      .pipe(tap((res) => this.user.set(res.user)));
  }

  setUser(user: AuthUser): void {
    const householdChanged = this.user()?.householdId !== user.householdId;
    this.user.set(user);
    this.ready.set(true);
    if (isNativeApp()) {
      if (householdChanged) {
        void this.widget.clear().catch(() => undefined).then(() => this.syncNativeWidget());
      } else {
        void this.syncNativeWidget();
      }
    }
  }

  registerMobileInvitation(token: string, payload: { displayName: string; password: string }): Observable<{ user: AuthUser }> {
    return this.mobileLoginOrRegister(
      `${API_BASE_URL}/auth/mobile/invitations/${encodeURIComponent(token)}/register`,
      payload,
    );
  }

  async nativeAccessToken(): Promise<string | null> {
    if (!isNativeApp() || this.nativeLoggingOut) return null;
    if (this.accessToken && Date.now() < this.accessExpiresAt - MOBILE_AUTH.accessExpiryMarginMs) {
      return this.accessToken;
    }
    const response = await this.refreshMobileSession();
    return response?.accessToken ?? null;
  }

  async nativeRefreshAfterUnauthorized(usedToken: string): Promise<string | null> {
    if (!isNativeApp() || this.nativeLoggingOut) return null;
    if (this.accessToken && this.accessToken !== usedToken) return this.accessToken;
    const response = await this.refreshMobileSession();
    return response?.accessToken ?? null;
  }

  logout(): void {
    if (isNativeApp()) {
      void this.logoutNative();
      return;
    }
    void this.logoutAndClearPush();
  }

  private mobileLoginOrRegister(path: string, payload: unknown): Observable<{ user: AuthUser }> {
    return this.http.post<MobileAuthResponse>(path, payload).pipe(
      switchMap((response) => from(this.acceptMobileSession(response))),
      map(({ user }) => ({ user })),
    );
  }

  private async acceptMobileSession(response: MobileAuthResponse): Promise<MobileAuthResponse> {
    const version = ++this.sessionVersion;
    let previousRefreshToken: string | null = null;
    try {
      this.widget.setActionCredential(null);
      await this.widget.clear().catch(() => undefined);
      previousRefreshToken = await this.nativeRefreshTokens.read();
      if (version !== this.sessionVersion || this.nativeLoggingOut) throw new Error('Мобільний вхід скасовано.');
      await this.mutateRefreshToken(() => this.nativeRefreshTokens.write(response.refreshToken));
      if (version !== this.sessionVersion || this.nativeLoggingOut) throw new Error('Мобільний вхід скасовано.');
    } catch (error) {
      await this.revokeMobileSession(response.refreshToken);
      throw error;
    }
    this.accessToken = response.accessToken;
    this.accessExpiresAt = Date.parse(response.accessExpiresAt);
    this.widget.setActionCredential(response.actionCredential);
    this.user.set(response.user);
    this.ready.set(true);
    if (previousRefreshToken && previousRefreshToken !== response.refreshToken) {
      void this.revokeMobileSession(previousRefreshToken);
    }
    void this.syncNativeWidget();
    return response;
  }

  private refreshMobileSession(): Promise<MobileAuthResponse | null> {
    this.refreshPromise ??= this.performMobileRefresh().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  private async performMobileRefresh(): Promise<MobileAuthResponse | null> {
    const version = this.sessionVersion;
    if (this.nativeLoggingOut) return null;
    const refreshToken = await this.nativeRefreshTokens.read();
    if (version !== this.sessionVersion || this.nativeLoggingOut) return null;
    if (!refreshToken) {
      await this.widget.clear().catch(() => undefined);
      return null;
    }
    try {
      const response = await firstValueFrom(this.rawHttp.post<MobileAuthResponse>(
        mobileApiUrl(`${API_BASE_URL}/auth/mobile/refresh`, this.mobileApiOrigin),
        { refreshToken },
      ));
      if (version !== this.sessionVersion || this.nativeLoggingOut) {
        await this.revokeMobileSession(response.refreshToken);
        return null;
      }
      try {
        await this.mutateRefreshToken(() => this.nativeRefreshTokens.write(response.refreshToken));
      } catch (error) {
        await this.revokeMobileSession(response.refreshToken);
        if (version === this.sessionVersion && !this.nativeLoggingOut) await this.invalidateNativeSession();
        throw error;
      }
      if (version !== this.sessionVersion || this.nativeLoggingOut) {
        await this.revokeMobileSession(response.refreshToken);
        return null;
      }
      this.accessToken = response.accessToken;
      this.accessExpiresAt = Date.parse(response.accessExpiresAt);
      this.widget.setActionCredential(response.actionCredential);
      this.user.set(response.user);
      this.ready.set(true);
      return response;
    } catch (error) {
      if (version === this.sessionVersion && error instanceof HttpErrorResponse && error.status === 401) {
        await this.invalidateNativeSession();
      }
      throw error;
    }
  }

  private async invalidateNativeSession(): Promise<void> {
    this.sessionVersion += 1;
    this.accessToken = null;
    this.accessExpiresAt = 0;
    this.widget.setActionCredential(null);
    this.user.set(null);
    this.ready.set(true);
    await Promise.allSettled([
      this.mutateRefreshToken(() => this.nativeRefreshTokens.clear()),
      this.widget.clear(),
    ]);
  }

  private async logoutNative(): Promise<void> {
    if (this.nativeLoggingOut) return;
    this.nativeLoggingOut = true;
    this.sessionVersion += 1;
    this.accessToken = null;
    this.accessExpiresAt = 0;
    this.widget.setActionCredential(null);
    this.user.set(null);
    this.ready.set(true);
    const pendingRefresh = this.refreshPromise;
    try {
      const refreshToken = await this.nativeRefreshTokens.read().catch(() => null);
      await this.invalidateNativeSession();
      await this.waitForPendingRefresh(pendingRefresh);
      if (refreshToken) await this.revokeMobileSession(refreshToken);
    } finally {
      this.nativeLoggingOut = false;
      void this.router.navigateByUrl('/login');
    }
  }

  private async waitForPendingRefresh(pending: Promise<MobileAuthResponse | null> | null): Promise<void> {
    if (!pending) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        pending.then(() => undefined, () => undefined),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, MOBILE_AUTH.revokeTimeoutMs); }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private mutateRefreshToken(action: () => Promise<void>): Promise<void> {
    const mutation = this.refreshTokenMutation.then(action, action);
    this.refreshTokenMutation = mutation.catch(() => undefined);
    return mutation;
  }

  private async revokeMobileSession(refreshToken: string): Promise<void> {
    try {
      await firstValueFrom(this.rawHttp.post(
        mobileApiUrl(`${API_BASE_URL}/auth/mobile/logout`, this.mobileApiOrigin),
        { refreshToken },
      ).pipe(timeout(MOBILE_AUTH.revokeTimeoutMs)));
    } catch {
      // Local credentials are removed even when the server is temporarily unreachable.
    }
  }

  private async syncNativeWidget(): Promise<void> {
    const user = this.user();
    if (!user) return;
    const version = this.sessionVersion;
    try {
      await this.widget.refresh(this.http, () =>
        version === this.sessionVersion &&
        !this.nativeLoggingOut &&
        this.user()?.userId === user.userId &&
        this.user()?.householdId === user.householdId,
      );
    } catch {
      // A widget refresh must not invalidate an otherwise healthy login.
    }
  }

  private async restoreNativeSession(): Promise<void> {
    if (this.nativeLoggingOut || this.user()) return;
    const version = this.sessionVersion;
    try {
      const response = await this.refreshMobileSession();
      if (!response || version !== this.sessionVersion || this.nativeLoggingOut) return;
      void this.syncNativeWidget();
      if (this.router.url === '/login') {
        void this.router.navigateByUrl(this.consumePostLoginRoute());
      }
    } catch {
      // A retained refresh token can be retried when the connection returns.
    }
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
