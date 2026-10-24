import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/configs/api.config';
import { ApiService } from '../../core/services/api.service';
import { readPushSubscription } from '../../core/push-subscription';
import { ToastService } from '../../core/toast/toast.service';
import type { SleepReminderConfig } from './sleep-reminder.model';
import { pushErrorMessage, pushSubscriptionPayload } from './sleep-reminder.util';

@Injectable()
export class SleepReminderService {
  private readonly api = inject(ApiService);
  private readonly push = inject(SwPush);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toasts = inject(ToastService);
  private endpoint: string | null = null;
  readonly supported = signal(
    this.push.isEnabled && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined',
  );
  readonly config = httpResource<SleepReminderConfig>(
    () => ({ url: `${API_BASE_URL}/sleep-reminders/config`, withCredentials: true }),
    { defaultValue: { available: false, publicKey: null } },
  );
  readonly available = computed(() => this.config.hasValue() && this.config.value().available);
  readonly enabled = signal(false);
  readonly busy = signal(false);

  constructor() {
    if (!this.supported()) return;
    this.push.subscription.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subscription) => {
        if (subscription) {
          this.remember(subscription);
          return;
        }
        // Samsung resolves an earlier getSubscription() with null after subscribe() already succeeded.
        if (this.endpoint) return;
        this.enabled.set(false);
      },
      error: () => {
        // A browser can expose service workers without a usable push manager.
        this.supported.set(false);
        this.enabled.set(false);
      },
    });
  }

  async enable(): Promise<void> {
    const publicKey = this.config.hasValue() ? this.config.value().publicKey : null;
    if (!this.supported() || !publicKey) {
      this.toasts.error('Сповіщення недоступні на цьому пристрої або сервері.');
      return;
    }
    this.busy.set(true);
    try {
      // Keep this call directly in the button gesture for iOS permission prompts.
      const subscription = await this.push.requestSubscription({ serverPublicKey: publicKey });
      await this.publish(subscription);
      this.remember(subscription);
      this.toasts.success('Сповіщення ввімкнено на цьому пристрої.');
    } catch (error) {
      try { await this.push.unsubscribe(); } catch { /* No active subscription to remove. */ }
      this.endpoint = null;
      this.enabled.set(false);
      if (!(error instanceof HttpErrorResponse)) this.toasts.error(pushErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    this.busy.set(true);
    try {
      const endpoint = this.endpoint ?? (await readPushSubscription())?.endpoint ?? null;
      if (endpoint) {
        await firstValueFrom(this.api.post('/sleep-reminders/unsubscribe', { endpoint }));
      }
      const current = await readPushSubscription();
      if (current) await current.unsubscribe();
      this.endpoint = null;
      this.enabled.set(false);
      this.toasts.success('Сповіщення вимкнено на цьому пристрої.');
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) this.toasts.error('Не вдалося вимкнути сповіщення. Спробуйте ще раз.');
    } finally {
      this.busy.set(false);
    }
  }

  private remember(subscription: PushSubscription): void {
    this.endpoint = subscription.endpoint;
    this.enabled.set(true);
  }

  private async publish(subscription: PushSubscription): Promise<void> {
    const payload = pushSubscriptionPayload(subscription);
    await firstValueFrom(this.api.post('/sleep-reminders/subscribe', payload));
  }
}
