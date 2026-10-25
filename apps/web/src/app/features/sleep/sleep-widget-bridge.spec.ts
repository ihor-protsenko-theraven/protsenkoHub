import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import type { SleepWidgetSnapshot } from './sleep-widget.model';
import { clearSleepWidgetSnapshot, refreshSleepWidgetSnapshot } from './sleep-widget-bridge';

const plugin = vi.hoisted(() => ({
  setSnapshot: vi.fn(async (_options: { snapshot: string }) => undefined),
  clear: vi.fn(async () => undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => plugin,
}));

const snapshot: SleepWidgetSnapshot = {
  schemaVersion: 1,
  serverNow: '2026-10-24T10:00:00.000Z',
  timeZone: 'Europe/Kyiv',
  childName: 'Соломія',
  state: 'sleeping',
  nextSleepAt: null,
  active: {
    sessionId: 'sleep-1',
    revision: 2,
    kind: 'NAP',
    startedAt: '2026-10-24T09:00:00.000Z',
    pauseStartedAt: null,
    asleepMs: 60_000,
  },
};

describe('sleep widget bridge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes the server snapshot with a local receipt timestamp', async () => {
    const http = { get: vi.fn(() => of(snapshot)) } as unknown as HttpClient;

    await refreshSleepWidgetSnapshot(http, undefined, () => ({
      actionCredential: { token: 'widget-action-token', expiresAt: '2026-11-24T10:00:00.000Z' },
      apiOrigin: 'https://api.example.test',
    }));

    expect(plugin.setSnapshot).toHaveBeenCalledOnce();
    const published = plugin.setSnapshot.mock.calls[0]![0] as {
      snapshot: string;
      actionCredential: { token: string };
      apiOrigin: string;
    };
    const cached = JSON.parse(published.snapshot) as Record<string, unknown>;
    expect(cached['childName']).toBe('Соломія');
    expect(cached['receivedAt']).toEqual(expect.any(String));
    expect(published.snapshot).not.toContain('widget-action-token');
    expect(published.actionCredential.token).toBe('widget-action-token');
    expect(published.apiOrigin).toBe('https://api.example.test');
  });

  it('does not republish an older household after logout clears the widget', async () => {
    const response = new Subject<SleepWidgetSnapshot>();
    const http = { get: vi.fn(() => response.asObservable()) } as unknown as HttpClient;
    let sessionCurrent = true;
    const pending = refreshSleepWidgetSnapshot(http, () => sessionCurrent);

    sessionCurrent = false;
    await clearSleepWidgetSnapshot();
    response.next(snapshot);
    response.complete();
    await pending;

    expect(plugin.clear).toHaveBeenCalledOnce();
    expect(plugin.setSnapshot).not.toHaveBeenCalled();
  });

  it('does not let an old unauthorized response clear a newer session', async () => {
    const response = new Subject<SleepWidgetSnapshot>();
    const http = { get: vi.fn(() => response.asObservable()) } as unknown as HttpClient;
    const oldRequest = refreshSleepWidgetSnapshot(http);
    await refreshSleepWidgetSnapshot({ get: () => of(snapshot) } as unknown as HttpClient);

    response.error(new HttpErrorResponse({ status: 401 }));
    await expect(oldRequest).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(plugin.setSnapshot).toHaveBeenCalledOnce();
    expect(plugin.clear).not.toHaveBeenCalled();
  });
});
