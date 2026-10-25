import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/configs/api.config';
import { MOBILE_API_ORIGIN_TOKEN } from '../../core/configs/mobile-api.config';
import { CachedSleepWidgetSnapshot, SleepWidgetSnapshot } from './sleep-widget.model';

interface SleepWidgetPlugin {
  setSnapshot(options: {
    snapshot: string;
    actionCredential: WidgetActionCredential | null;
    apiOrigin: string;
  }): Promise<void>;
  clear(): Promise<void>;
}

export interface WidgetActionCredential {
  token: string;
  expiresAt: string;
}

interface WidgetActionOptions {
  actionCredential: WidgetActionCredential | null;
  apiOrigin: string;
}

export interface SleepWidgetBridge {
  clear(): Promise<void>;
  refresh(http: HttpClient, isCurrent?: () => boolean): Promise<void>;
  setActionCredential(credential: WidgetActionCredential | null): void;
}

export const SLEEP_WIDGET_BRIDGE = new InjectionToken<SleepWidgetBridge>('SLEEP_WIDGET_BRIDGE', {
  providedIn: 'root',
  factory: () => {
    const apiOrigin = inject(MOBILE_API_ORIGIN_TOKEN);
    let actionCredential: WidgetActionCredential | null = null;
    return {
      clear: clearSleepWidgetSnapshot,
      refresh: (http, isCurrent) => refreshSleepWidgetSnapshot(
        http,
        isCurrent,
        () => ({ actionCredential, apiOrigin }),
      ),
      setActionCredential: (credential) => { actionCredential = credential; },
    };
  },
});

const nativeWidget = registerPlugin<SleepWidgetPlugin>('SleepWidget');
let cacheGeneration = 0;
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(action: () => Promise<void>): Promise<void> {
  const write = writeQueue.then(action, action);
  writeQueue = write.catch(() => undefined);
  return write;
}

export async function publishSleepWidgetSnapshot(
  snapshot: SleepWidgetSnapshot,
  isCurrent: () => boolean = () => true,
  actionOptions: () => WidgetActionOptions = () => ({ actionCredential: null, apiOrigin: '' }),
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await enqueueWrite(async () => {
    if (!isCurrent()) return;
    const cached: CachedSleepWidgetSnapshot = {
      ...snapshot,
      receivedAt: new Date().toISOString(),
    };
    await nativeWidget.setSnapshot({ snapshot: JSON.stringify(cached), ...actionOptions() });
  });
}

export async function clearSleepWidgetSnapshot(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  cacheGeneration += 1;
  await enqueueWrite(() => nativeWidget.clear());
}

export async function refreshSleepWidgetSnapshot(
  http: HttpClient,
  isCurrent: () => boolean = () => true,
  actionOptions: () => WidgetActionOptions = () => ({ actionCredential: null, apiOrigin: '' }),
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const generation = ++cacheGeneration;
  const isLatest = () => generation === cacheGeneration && isCurrent();
  try {
    const snapshot = await firstValueFrom(http.get<SleepWidgetSnapshot>(
      `${API_BASE_URL}/children/sleep/widget`,
      { withCredentials: true },
    ));
    if (isLatest()) await publishSleepWidgetSnapshot(snapshot, isLatest, actionOptions);
  } catch (error) {
    if (isLatest() && error instanceof HttpErrorResponse && error.status === 401) {
      await clearSleepWidgetSnapshot();
    }
    throw error;
  }
}
