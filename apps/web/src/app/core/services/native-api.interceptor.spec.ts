import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { MOBILE_API_ORIGIN_TOKEN } from '../configs/mobile-api.config';
import { AuthService } from './auth.service';
import { nativeApiInterceptor } from './native-api.interceptor';

describe('native API transport', () => {
  const auth = {
    nativeAccessToken: vi.fn<() => Promise<string | null>>(),
    nativeRefreshAfterUnauthorized: vi.fn<(_token: string) => Promise<string | null>>(),
  };

  beforeEach(() => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    auth.nativeAccessToken.mockReset().mockResolvedValue('first-access');
    auth.nativeRefreshAfterUnauthorized.mockReset().mockResolvedValue('second-access');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([nativeApiInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: MOBILE_API_ORIGIN_TOKEN, useValue: 'https://api.example.test' },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('sends a bearer token only to the configured API origin and retries one unauthorized response', async () => {
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    const response = vi.fn();
    client.get('/api/v1/children/sleep/widget', { withCredentials: true }).subscribe(response);

    const initial = await waitForRequest(http, 'https://api.example.test/api/v1/children/sleep/widget');
    expect(initial.request.headers.get('Authorization')).toBe('Bearer first-access');
    expect(initial.request.withCredentials).toBe(false);
    initial.flush({}, { status: 401, statusText: 'Unauthorized' });

    const retry = await waitForRequest(http, 'https://api.example.test/api/v1/children/sleep/widget');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer second-access');
    retry.flush({ schemaVersion: 1 });
    expect(response).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(auth.nativeRefreshAfterUnauthorized).toHaveBeenCalledTimes(1);
    expect(auth.nativeRefreshAfterUnauthorized).toHaveBeenCalledWith('first-access');

    client.get('https://outside.example.test/data').subscribe();
    const outside = http.expectOne('https://outside.example.test/data');
    expect(outside.request.headers.has('Authorization')).toBe(false);
    outside.flush({});
    http.verify();
  });

  it('keeps login public while still routing it to the configured API', async () => {
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    client.post('/api/v1/auth/mobile/login', { email: 'a@example.test', password: 'password' }).subscribe();
    const login = await waitForRequest(http, 'https://api.example.test/api/v1/auth/mobile/login');
    expect(login.request.headers.has('Authorization')).toBe(false);
    expect(auth.nativeAccessToken).not.toHaveBeenCalled();
    login.flush({});
    http.verify();
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
