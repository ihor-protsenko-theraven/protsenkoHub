import type { SleepKind } from '@prisma/client';

export type HouseholdPushEvent =
  | {
      readonly type: 'sleep-started';
      readonly sessionId: string;
      readonly kind: SleepKind;
    }
  | {
      readonly type: 'sleep-stopped';
      readonly sessionId: string;
    }
  | {
      readonly type: 'task-completed';
      readonly taskId: string;
      readonly title: string;
    };

export interface HouseholdPushNotification {
  readonly title: string;
  readonly body: string;
  readonly tag: string;
  readonly url: string;
}

export interface HouseholdPushRecipient {
  readonly id: string;
  readonly userId: string;
  readonly householdId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}
