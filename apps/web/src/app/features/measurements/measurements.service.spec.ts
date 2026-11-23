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
  it('calls create, update and remove endpoints and updates the feed locally without extra reloads', async () => {
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

    // 2. Create call updates feed locally
    service
      .create({
        measuredAt: '2026-11-01T00:00:00.000Z',
        weightKg: 8.5,
      })
      .subscribe();

    http.expectOne({ method: 'POST', url: feedUrl }).flush({
      id: 'm1',
      measuredAt: '2026-11-01T00:00:00.000Z',
      weightKg: 8.5,
    });
    TestBed.tick();
    http.expectNone({ method: 'GET', url: feedUrl });
    expect(service.feed.value().measurements).toHaveLength(1);
    expect(service.feed.value().measurements[0]?.weightKg).toBe(8.5);

    // 3. Update call updates feed locally
    service
      .update('m1', {
        weightKg: 8.7,
      })
      .subscribe();

    http.expectOne({ method: 'PATCH', url: `${feedUrl}/m1` }).flush({
      id: 'm1',
      measuredAt: '2026-11-01T00:00:00.000Z',
      weightKg: 8.7,
    });
    TestBed.tick();
    http.expectNone({ method: 'GET', url: feedUrl });
    expect(service.feed.value().measurements[0]?.weightKg).toBe(8.7);

    // 4. Remove call removes item locally
    service.remove('m1').subscribe();
    http.expectOne({ method: 'DELETE', url: `${feedUrl}/m1` }).flush(null);
    TestBed.tick();
    http.expectNone({ method: 'GET', url: feedUrl });
    expect(service.feed.value().measurements).toEqual([]);

    http.verify();
  });
});
