import { httpResource } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/configs/api.config';
import { ApiService } from '../../core/services/api.service';
import { readPushSubscription } from '../../core/push-subscription';
import type { PushSubscriptionPayload, SleepReminderConfig } from './sleep-reminder.model';

@Injectable()
export class SleepReminderService {
  private readonly api = inject(ApiService);
  private readonly push = inject(SwPush);
  private readonly destroyRef = inject(DestroyRef);
  private endpoint: string | null = null;
  readonly supported = this.push.isEnabled;
  readonly config = httpResource<SleepReminderConfig>(
    () => ({ url: `${API_BASE_URL}/sleep-reminders/config`, withCredentials: true }),
    { defaultValue: { available: false, publicKey: null } },
  );
  readonly enabled = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');

  constructor() {
    if (!this.supported) return;
    this.push.subscription.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((subscription) => {
      if (subscription) {
        this.remember(subscription);
        return;
      }
      // Samsung resolves an earlier getSubscription() with null after subscribe() already succeeded.
      if (this.endpoint) return;
      this.enabled.set(false);
    });
  }

  async enable(): Promise<void> {
    const publicKey = this.config.value().publicKey;
    if (!this.supported || !publicKey) {
      this.message.set('Сповіщення недоступні на цьому пристрої або сервері.');
      return;
    }
    this.busy.set(true);
    this.message.set('');
    try {
      // Keep this call directly in the button gesture for iOS permission prompts.
      const subscription = await this.push.requestSubscription({ serverPublicKey: publicKey });
      await this.publish(subscription);
      this.remember(subscription);
      const settled = await readPushSubscription();
      if (settled) this.remember(settled);
      this.message.set('Нагадування ввімкнено на цьому пристрої.');
    } catch {
      try { await this.push.unsubscribe(); } catch { /* No active subscription to remove. */ }
      this.endpoint = null;
      this.enabled.set(false);
      this.message.set('Не вдалося ввімкнути сповіщення. Перевірте дозвіл у налаштуваннях пристрою.');
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    this.busy.set(true);
    this.message.set('');
    try {
      const endpoint = this.endpoint ?? (await readPushSubscription())?.endpoint ?? null;
      if (endpoint) {
        await firstValueFrom(this.api.post('/sleep-reminders/unsubscribe', { endpoint }));
      }
      const current = await readPushSubscription();
      if (current) await current.unsubscribe();
      this.endpoint = null;
      this.enabled.set(false);
      this.message.set('Нагадування вимкнено на цьому пристрої.');
    } catch {
      this.message.set('Не вдалося вимкнути сповіщення. Спробуйте ще раз.');
    } finally {
      this.busy.set(false);
    }
  }

  private remember(subscription: PushSubscription): void {
    this.endpoint = subscription.endpoint;
    this.enabled.set(true);
  }

  private publish(subscription: PushSubscription): Promise<unknown> {
    const payload = subscription.toJSON() as PushSubscriptionPayload;
    if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
      return Promise.reject(new Error('Incomplete push subscription'));
    }
    return firstValueFrom(this.api.post('/sleep-reminders/subscribe', payload));
  }
}
