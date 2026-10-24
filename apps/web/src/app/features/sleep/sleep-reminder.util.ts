import type { PushSubscriptionPayload } from './sleep-reminder.model';

export function pushSubscriptionPayload(subscription: Pick<PushSubscription, 'toJSON'>): PushSubscriptionPayload {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.['p256dh'] || !keys['auth']) {
    throw new Error('Incomplete push subscription');
  }
  return { endpoint, keys: { p256dh: keys['p256dh'], auth: keys['auth'] } };
}

export function pushErrorMessage(error: unknown): string {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Сповіщення заблоковано. Дозвольте їх у налаштуваннях браузера та Android.';
    if (error.name === 'AbortError') return 'Браузер перервав підписку на сповіщення. Спробуйте ще раз.';
  }
  return 'Не вдалося ввімкнути сповіщення. Перевірте дозвіл і спробуйте ще раз.';
}
