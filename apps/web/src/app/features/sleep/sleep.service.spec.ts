import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SLEEP_WIDGET_BRIDGE } from './sleep-widget-bridge';
import { SleepService } from './sleep.service';

describe('SleepService daily total', () => {
  it('refreshes after a saved sleep even when an overview request is already running', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SleepService,
        { provide: SLEEP_WIDGET_BRIDGE, useValue: { refresh: vi.fn().mockResolvedValue(undefined) } },
      ],
    });
    const service = TestBed.inject(SleepService);
    const http = TestBed.inject(HttpTestingController);
    const url = '/api/v1/children/sleep';

    TestBed.tick();
    http.expectOne({ method: 'GET', url }).flush({ stats: { todaySleepMin: 120 } });
    await vi.waitFor(() => expect(service.overview.status()).toBe('resolved'));

    expect(service.overview.reload()).toBe(true);
    TestBed.tick();
    const oldOverview = http.expectOne({ method: 'GET', url });

    service.create({
      kind: 'NAP',
      startedAt: '2026-10-25T10:00:00.000Z',
      endedAt: '2026-10-25T11:00:00.000Z',
      notes: null,
    }).subscribe();
    http.expectOne({ method: 'POST', url }).flush({ session: { id: 'saved' } });
    oldOverview.flush({ stats: { todaySleepMin: 120 } });
    TestBed.tick();

    const refreshed = await vi.waitFor(() => {
      const [request] = http.match({ method: 'GET', url });
      if (!request) throw new Error('No overview refresh after saving sleep');
      return request;
    });
    refreshed.flush({ stats: { todaySleepMin: 180 } });
    TestBed.tick();
    await vi.waitFor(() => expect(service.overview.value()?.stats.todaySleepMin).toBe(180));
    http.verify();
  });
});
