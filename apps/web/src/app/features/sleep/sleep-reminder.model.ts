export interface SleepReminderConfig {
  available: boolean;
  publicKey: string | null;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
