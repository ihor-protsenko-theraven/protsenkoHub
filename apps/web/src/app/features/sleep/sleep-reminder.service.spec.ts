import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { Observable, Subject } from 'rxjs';
import { ToastService } from '../../core/toast/toast.service';
import { SleepReminderService } from './sleep-reminder.service';
import { pushSubscriptionPayload } from './sleep-reminder.util';

describe('push subscription API payload', () => {
  it('excludes browser metadata that the API does not accept', () => {
    const subscription = {
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/wp/test',
        expirationTime: null,
        keys: { p256dh: 'public-key', auth: 'auth-secret' },
      }),
    };

    expect(pushSubscriptionPayload(subscription)).toEqual({
      endpoint: 'https://fcm.googleapis.com/wp/test',
      keys: { p256dh: 'public-key', auth: 'auth-secret' },
    });
  });
});

describe('sleep reminder initialization', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the toggle unavailable when the config request fails', async () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', class {});
    const subscription = new Subject<PushSubscription | null>();
    const service = createService({ isEnabled: true, subscription });
    const http = TestBed.inject(HttpTestingController);
    const toasts = TestBed.inject(ToastService);

    TestBed.tick();
    http.expectOne('/api/v1/sleep-reminders/config').flush('Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    TestBed.tick();

    expect(service.available()).toBe(false);
    await service.enable();
    expect(toasts.messages().at(-1)?.text).toContain('Сповіщення недоступні');
    http.verify();
  });

  it('does not subscribe when push is unavailable in the browser', () => {
    vi.stubGlobal('PushManager', undefined);
    const subscribe = vi.fn();
    const subscription = new Observable<PushSubscription | null>(() => subscribe());
    const service = createService({ isEnabled: true, subscription });

    expect(service.supported()).toBe(false);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('handles a failed push subscription without an unhandled error', () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', class {});
    const subscription = new Subject<PushSubscription | null>();
    const service = createService({ isEnabled: true, subscription });

    expect(service.supported()).toBe(true);
    subscription.error(new TypeError('PushManager is unavailable'));
    expect(service.supported()).toBe(false);
    expect(service.enabled()).toBe(false);
  });
});

function createService(push: Pick<SwPush, 'isEnabled' | 'subscription'>): SleepReminderService {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      ToastService,
      SleepReminderService,
      { provide: SwPush, useValue: push },
    ],
  });
  return TestBed.inject(SleepReminderService);
}
