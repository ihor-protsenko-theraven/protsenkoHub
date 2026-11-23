import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiCacheInterceptor, clearApiCache } from './api-cache.interceptor';

describe('apiCacheInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    clearApiCache(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiCacheInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    clearApiCache(true);
  });

  it('caches GET API responses and invalidates only matching domains after a mutation', async () => {
    const homePromise = firstValueFrom(http.get<{ ok: boolean }>('/api/v1/home'));
    controller.expectOne('/api/v1/home').flush({ ok: true });
    expect(await homePromise).toEqual({ ok: true });

    const contactsPromise = firstValueFrom(http.get<string[]>('/api/v1/contacts'));
    controller.expectOne('/api/v1/contacts').flush(['doctor']);
    expect(await contactsPromise).toEqual(['doctor']);

    const postPromise = firstValueFrom(http.post('/api/v1/shopping/items', { name: 'Milk' }));
    controller.expectOne('/api/v1/shopping/items').flush({ id: '1' });
    await postPromise;

    // Contacts remain cached across a shopping mutation.
    expect(await firstValueFrom(http.get<string[]>('/api/v1/contacts'))).toEqual(['doctor']);
    controller.expectNone('/api/v1/contacts');

    // Home is invalidated by the shopping mutation.
    const refreshedHome = firstValueFrom(http.get<{ ok: boolean }>('/api/v1/home'));
    controller.expectOne('/api/v1/home').flush({ ok: false });
    expect(await refreshedHome).toEqual({ ok: false });
  });

  it('coalesces simultaneous in-flight GET requests into one HTTP call', async () => {
    const first = firstValueFrom(http.get<string[]>('/api/v1/contacts'));
    const second = firstValueFrom(http.get<string[]>('/api/v1/contacts'));

    const req = controller.expectOne('/api/v1/contacts');
    req.flush(['pediatrician']);

    expect(await first).toEqual(['pediatrician']);
    expect(await second).toEqual(['pediatrician']);
  });

  it('never caches excluded auth or widget endpoints', async () => {
    const first = firstValueFrom(http.get('/api/v1/auth/me'));
    controller.expectOne('/api/v1/auth/me').flush({ user: { userId: '1' } });
    await first;

    const second = firstValueFrom(http.get('/api/v1/auth/me'));
    controller.expectOne('/api/v1/auth/me').flush({ user: { userId: '1' } });
    await second;
  });

  it('keeps static feeding dictionary cached across mutations', async () => {
    const first = firstValueFrom(http.get('/api/v1/feeding/dictionary'));
    controller.expectOne('/api/v1/feeding/dictionary').flush([{ id: 'cat-1' }]);
    await first;

    const put = firstValueFrom(http.put('/api/v1/feeding/records/food-1', { status: 'INTRODUCED' }));
    controller.expectOne('/api/v1/feeding/records/food-1').flush({ id: 'rec-1' });
    await put;

    const second = await firstValueFrom(http.get('/api/v1/feeding/dictionary'));
    expect(second).toEqual([{ id: 'cat-1' }]);
    controller.expectNone('/api/v1/feeding/dictionary');
  });
});
