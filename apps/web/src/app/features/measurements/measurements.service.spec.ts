import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '../../core/configs/api.config';
import { MeasurementsService } from './measurements.service';

describe('MeasurementsService', () => {
  it('calls create, update and remove endpoints and reloads the feed', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MeasurementsService,
      ],
    });

    const service = TestBed.inject(MeasurementsService);
    const http = TestBed.inject(HttpTestingController);
    const feedUrl = `${API_BASE_URL}/children/measurements`;

    // 1. Initial feed fetch
    TestBed.tick();
    http.expectOne({ method: 'GET', url: feedUrl }).flush({
      child: { id: 'c1', name: 'Малюк', birthDate: null },
      measurements: [],
    });
    await vi.waitFor(() => expect(service.feed.status()).toBe('resolved'));

    // 2. Create call
    service
      .create({
        measuredAt: '2026-11-01T00:00:00.000Z',
        weightKg: 8.5,
      })
      .subscribe();

    http.expectOne({ method: 'POST', url: feedUrl }).flush({ id: 'm1' });
    TestBed.tick();

    const createReload = await vi.waitFor(() => {
      const [req] = http.match({ method: 'GET', url: feedUrl });
      if (!req) throw new Error('No reload request after create');
      return req;
    });
    createReload.flush({
      child: { id: 'c1', name: 'Малюк', birthDate: null },
      measurements: [{ id: 'm1', weightKg: 8.5 }],
    });
    await vi.waitFor(() => expect(service.feed.status()).toBe('resolved'));

    // 3. Update call
    service
      .update('m1', {
        weightKg: 8.7,
      })
      .subscribe();

    http.expectOne({ method: 'PATCH', url: `${feedUrl}/m1` }).flush({ id: 'm1' });
    TestBed.tick();

    const updateReload = await vi.waitFor(() => {
      const [req] = http.match({ method: 'GET', url: feedUrl });
      if (!req) throw new Error('No reload request after update');
      return req;
    });
    updateReload.flush({
      child: { id: 'c1', name: 'Малюк', birthDate: null },
      measurements: [{ id: 'm1', weightKg: 8.7 }],
    });
    await vi.waitFor(() => expect(service.feed.status()).toBe('resolved'));

    // 4. Remove call
    service.remove('m1').subscribe();
    http.expectOne({ method: 'DELETE', url: `${feedUrl}/m1` }).flush(null);
    TestBed.tick();

    const removeReload = await vi.waitFor(() => {
      const [req] = http.match({ method: 'GET', url: feedUrl });
      if (!req) throw new Error('No reload request after remove');
      return req;
    });
    removeReload.flush({
      child: { id: 'c1', name: 'Малюк', birthDate: null },
      measurements: [],
    });
    await vi.waitFor(() => expect(service.feed.status()).toBe('resolved'));

    http.verify();
  });
});
