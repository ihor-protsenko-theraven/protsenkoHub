import { Injectable, Logger } from '@nestjs/common';
import type { SleepKind } from '@prisma/client';
import * as webPush from 'web-push';
import type { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { HOUSEHOLD_PUSH } from './household-push.config';
import type {
  HouseholdPushEvent,
  HouseholdPushNotification,
} from './household-push.model';
import { SLEEP_TRACKER } from './sleep/sleep.config';

@Injectable()
export class HouseholdPushService {
  private readonly logger = new Logger(HouseholdPushService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(
    actor: Pick<AuthUser, 'userId' | 'displayName' | 'householdId'>,
    event: HouseholdPushEvent,
  ): Promise<{ readonly sent: number }> {
    const vapidDetails = this.vapidDetails();
    if (!vapidDetails) {
      return { sent: 0 };
    }
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: {
          householdId: actor.householdId,
          userId: { not: actor.userId },
        },
      });
      const recipients = subscriptions.filter(
        (sub) =>
          (!sub.householdId || sub.householdId === actor.householdId) &&
          sub.userId !== actor.userId,
      );
      if (recipients.length === 0) {
        return { sent: 0 };
      }
      const payload = this.payload(actor.displayName, event);
      let sent = 0;
      for (const device of recipients) {
        try {
          await webPush.sendNotification(
            {
              endpoint: device.endpoint,
              keys: { p256dh: device.p256dh, auth: device.auth },
            },
            payload,
            {
              vapidDetails,
              TTL: HOUSEHOLD_PUSH.pushTtlSeconds,
              urgency: HOUSEHOLD_PUSH.urgency,
              timeout: HOUSEHOLD_PUSH.pushTimeoutMs,
            },
          );
          sent += 1;
        } catch (error: unknown) {
          const status = readPushStatusCode(error);
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.deleteMany({
              where: { id: device.id },
            });
          } else {
            this.logger.warn(
              `Push delivery failed with status ${status ?? 'unknown'}`,
            );
          }
        }
      }
      return { sent };
    } catch {
      this.logger.warn('Push notification dispatch failed');
      return { sent: 0 };
    }
  }

  private payload(displayName: string, event: HouseholdPushEvent): string {
    const item = this.buildNotification(displayName, event);
    return JSON.stringify({
      notification: {
        title: item.title,
        body: item.body,
        icon: HOUSEHOLD_PUSH.icon,
        tag: item.tag,
        data: {
          onActionClick: {
            default: {
              operation: HOUSEHOLD_PUSH.clickOperation,
              url: item.url,
            },
          },
        },
      },
    });
  }

  private buildNotification(
    displayName: string,
    event: HouseholdPushEvent,
  ): HouseholdPushNotification {
    switch (event.type) {
      case 'sleep-started':
        return {
          title: HOUSEHOLD_PUSH.titles.sleepStarted,
          body: `${displayName} почав ${sleepKindLabel(event.kind)}`,
          tag: `${HOUSEHOLD_PUSH.tagPrefixes.sleepStarted}-${event.sessionId}`,
          url: HOUSEHOLD_PUSH.paths.sleep,
        };
      case 'sleep-stopped':
        return {
          title: HOUSEHOLD_PUSH.titles.sleepStopped,
          body: `${displayName} завершив сон`,
          tag: `${HOUSEHOLD_PUSH.tagPrefixes.sleepStopped}-${event.sessionId}`,
          url: HOUSEHOLD_PUSH.paths.sleep,
        };
      case 'task-completed':
        return {
          title: HOUSEHOLD_PUSH.titles.taskCompleted,
          body: `${displayName}: ${event.title}`,
          tag: `${HOUSEHOLD_PUSH.tagPrefixes.taskCompleted}-${event.taskId}`,
          url: HOUSEHOLD_PUSH.paths.children,
        };
      default: {
        const exhaustive: never = event;
        return exhaustive;
      }
    }
  }

  private vapidDetails(): {
    readonly subject: string;
    readonly publicKey: string;
    readonly privateKey: string;
  } | null {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!subject || !publicKey || !privateKey) {
      return null;
    }
    return { subject, publicKey, privateKey };
  }
}

export function sleepKindLabel(kind: SleepKind): string {
  switch (kind) {
    case 'NAP':
      return SLEEP_TRACKER.kindLabels.nap;
    case 'NIGHT':
      return SLEEP_TRACKER.kindLabels.night;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function readPushStatusCode(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }
  return undefined;
}
