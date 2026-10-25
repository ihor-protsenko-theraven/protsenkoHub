import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { MOBILE_API_ORIGIN_TOKEN } from '../configs/mobile-api.config';
import { SLEEP_WIDGET_BRIDGE } from '../../features/sleep/sleep-widget-bridge';
import { AuthService } from './auth.service';
import { NATIVE_REFRESH_TOKEN_STORE, NativeRefreshTokenStore } from './native-refresh-token';

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
    getLaunchUrl: vi.fn(async () => undefined),
  },
}));

const user = {
  userId: 'user-1', email: 'mama@example.test', displayName: 'Мама',
  householdId: 'household-1', membershipId: 'membership-1', role: 'ADMIN' as const,
  color: '#123456',
};

describe('mobile session', () => {
  let refreshToken: string | null;
  let store: NativeRefreshTokenStore;
  const widget = {
    clear: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    setActionCredential: vi.fn(),
  };

  beforeEach(() => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    widget.clear.mockReset().mockResolvedValue(undefined);
    widget.refresh.mockReset().mockResolvedValue(undefined);
    widget.setActionCredential.mockReset();
    vi.mocked(App.addListener).mockReset().mockResolvedValue({ remove: vi.fn() });
    vi.mocked(App.getLaunchUrl).mockReset().mockResolvedValue(undefined);
    refreshToken = 'session.old';
    store = {
      read: vi.fn(async () => refreshToken),
      write: vi.fn(async (token: string) => { refreshToken = token; }),
      clear: vi.fn(async () => { refreshToken = null; }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SwPush, useValue: { isEnabled: false } },
        { provide: Router, useValue: { navigateByUrl: vi.fn(async () => true) } },
        { provide: MOBILE_API_ORIGIN_TOKEN, useValue: 'https://api.example.test' },
        { provide: NATIVE_REFRESH_TOKEN_STORE, useValue: store },
        { provide: SLEEP_WIDGET_BRIDGE, useValue: widget },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('shares one refresh request and stores the rotated token before using access', async () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const first = auth.nativeAccessToken();
    const second = auth.nativeAccessToken();

    const request = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/refresh');
    expect(request.request.body).toEqual({ refreshToken: 'session.old' });
    expect(http.match('https://api.example.test/api/v1/auth/mobile/refresh')).toHaveLength(0);
    request.flush({
      user, accessToken: 'access-new', refreshToken: 'session.new',
      accessExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      actionCredential: { token: 'widget-new', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    });

    expect(await Promise.all([first, second])).toEqual(['access-new', 'access-new']);
    expect(store.write).toHaveBeenCalledTimes(1);
    expect(refreshToken).toBe('session.new');
    expect(auth.user()).toEqual(user);
    expect(widget.setActionCredential).toHaveBeenCalledWith(expect.objectContaining({ token: 'widget-new' }));
    http.verify();
  });

  it('clears local credentials when the refresh token is rejected', async () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const pending = auth.nativeAccessToken();
    const request = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/refresh');
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(refreshToken).toBeNull();
    expect(auth.user()).toBeNull();
    http.verify();
  });

  it('restores a retained session when connectivity returns after an offline launch', async () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', { value: '/login', configurable: true });
    const failed = vi.fn();
    auth.bootstrap().subscribe({ error: failed });
    const initial = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/refresh');
    initial.flush({}, { status: 0, statusText: 'Offline' });
    await vi.waitFor(() => expect(failed).toHaveBeenCalledTimes(1));
    expect(auth.ready()).toBe(true);
    expect(auth.user()).toBeNull();
    expect(refreshToken).toBe('session.old');

    window.dispatchEvent(new Event('online'));
    const retry = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/refresh');
    retry.flush({
      user, accessToken: 'access-new', refreshToken: 'session.new',
      accessExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      actionCredential: { token: 'widget-new', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    });
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalledWith('/app/home'));
    expect(auth.user()).toEqual(user);
    expect(refreshToken).toBe('session.new');
    http.verify();
  });

  it('clears local state immediately and revokes the rotated session before leaving the app', async () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const pendingAccess = auth.nativeAccessToken();
    const refresh = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/refresh');

    auth.logout();
    await vi.waitFor(() => expect(store.clear).toHaveBeenCalledTimes(1));
    expect(auth.user()).toBeNull();
    expect(refreshToken).toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/login');

    refresh.flush({
      user, accessToken: 'late-access', refreshToken: 'session.rotated',
      accessExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      actionCredential: { token: 'widget-rotated', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    });
    const rotatedRevoke = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/logout');
    expect(rotatedRevoke.request.body).toEqual({ refreshToken: 'session.rotated' });
    rotatedRevoke.flush({});
    expect(await pendingAccess).toBeNull();
    const oldRevoke = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/logout');
    expect(oldRevoke.request.body).toEqual({ refreshToken: 'session.old' });
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/login');
    oldRevoke.flush({});
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalledWith('/login'));
    expect(refreshToken).toBeNull();
    expect(auth.user()).toBeNull();
    http.verify();
  });

  it('does not start a refresh when secure storage finishes reading after logout', async () => {
    const oldRead = deferred<string | null>();
    let reads = 0;
    store.read = vi.fn(() => ++reads === 1 ? oldRead.promise : Promise.resolve('session.old'));
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    const pendingAccess = auth.nativeAccessToken();
    auth.logout();
    oldRead.resolve('session.old');

    expect(await pendingAccess).toBeNull();
    expect(http.match('https://api.example.test/api/v1/auth/mobile/refresh')).toHaveLength(0);
    const revoke = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/logout');
    expect(revoke.request.body).toEqual({ refreshToken: 'session.old' });
    revoke.flush({});
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalledWith('/login'));
    http.verify();
  });

  it('revokes a rotated token and clears it when logout races with secure storage write', async () => {
    const writeStarted = deferred<void>();
    const finishWrite = deferred<void>();
    store.write = vi.fn(async (token: string) => {
      writeStarted.resolve();
      await finishWrite.promise;
      refreshToken = token;
    });
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    const pendingAccess = auth.nativeAccessToken();
    const refresh = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/refresh');
    refresh.flush({
      user, accessToken: 'late-access', refreshToken: 'session.rotated',
      accessExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      actionCredential: { token: 'widget-rotated', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    });
    await writeStarted.promise;
    auth.logout();
    expect(auth.user()).toBeNull();
    finishWrite.resolve();

    const rotatedRevoke = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/logout');
    expect(rotatedRevoke.request.body).toEqual({ refreshToken: 'session.rotated' });
    rotatedRevoke.flush({});
    expect(await pendingAccess).toBeNull();
    expect(refreshToken).toBeNull();
    const oldRevoke = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/logout');
    expect(oldRevoke.request.body).toEqual({ refreshToken: 'session.old' });
    oldRevoke.flush({});
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalledWith('/login'));
    http.verify();
  });

  it('clears the prior household widget before refreshing after an invitation is accepted', async () => {
    const cleared = deferred<undefined>();
    widget.clear.mockImplementationOnce(() => cleared.promise);
    const auth = TestBed.inject(AuthService);
    auth.user.set(user);

    auth.setUser({ ...user, householdId: 'household-2' });
    expect(widget.clear).toHaveBeenCalledTimes(1);
    expect(widget.refresh).not.toHaveBeenCalled();
    cleared.resolve(undefined);
    await vi.waitFor(() => expect(widget.refresh).toHaveBeenCalledTimes(1));
    expect(auth.user()?.householdId).toBe('household-2');
  });

  it('allows a valid login when widget cache clearing fails', async () => {
    widget.clear.mockRejectedValueOnce(new Error('widget unavailable'));
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const result = vi.fn();
    auth.login(user.email, 'password').subscribe(result);
    const login = http.expectOne('/api/v1/auth/mobile/login');
    login.flush({
      user, accessToken: 'access-new', refreshToken: 'session.new',
      accessExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      actionCredential: { token: 'widget-new', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    });
    await vi.waitFor(() => expect(result).toHaveBeenCalledWith({ user }));
    expect(refreshToken).toBe('session.new');
    const revoke = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/logout');
    revoke.flush({});
    http.verify();
  });

  it('preserves the web cookie login and bootstrap requests', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    auth.login(user.email, 'password').subscribe();
    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.withCredentials).toBe(true);
    login.flush({ user });

    auth.bootstrap().subscribe();
    const bootstrap = http.expectOne('/api/v1/auth/me');
    expect(bootstrap.request.withCredentials).toBe(true);
    bootstrap.flush({ user });

    expect(auth.user()).toEqual(user);
    expect(store.read).not.toHaveBeenCalled();
    expect(store.write).not.toHaveBeenCalled();
    http.verify();
  });

  it('keeps a sleep widget link as the post-login destination', () => {
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const registrations = vi.mocked(App.addListener).mock.calls as unknown as [
      string,
      (event: { url: string }) => void,
    ][];
    const registration = registrations.find(([event]) => event === 'appUrlOpen');
    expect(registration).toBeDefined();
    const openUrl = registration![1];

    openUrl({ url: 'protsenkohub://sleep' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/sleep');
    expect(auth.consumePostLoginRoute()).toBe('/app/sleep');
    expect(auth.consumePostLoginRoute()).toBe('/app/home');
  });
});

async function waitForRequest(http: HttpTestingController, url: string) {
  let request = http.match(url)[0];
  await vi.waitFor(() => {
    request = http.match(url)[0] ?? request;
    expect(request).toBeDefined();
  });
  return request!;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
