import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/types';
import * as webPush from 'web-push';
import { formatClock } from './sleep-time';
import { SLEEP_REMINDER } from './sleep-reminder.config';
import { dueSleepReminders } from './sleep-reminder-time';
import type { PushError, ReminderMoment } from './sleep-reminder.model';
import type { PushSubscriptionDto } from './dto/push-subscription.dto';
import { SleepService } from './sleep.service';

@Injectable()
export class SleepReminderService {
  private readonly logger = new Logger(SleepReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sleep: SleepService,
  ) {}

  configuration() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    return {
      available: Boolean(publicKey && privateKey && subject),
      publicKey: publicKey ?? null,
    };
  }

  async subscribe(user: AuthUser, dto: PushSubscriptionDto) {
    if (!this.configuration().available) {
      throw new ServiceUnavailableException(
        'Сповіщення ще не налаштовані на сервері.',
      );
    }
    if (!isAllowedPushEndpoint(dto.endpoint)) {
      throw new BadRequestException('Цей push-сервіс не підтримується.');
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId: user.userId,
        householdId: user.householdId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: {
        userId: user.userId,
        householdId: user.householdId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
    return { enabled: true };
  }

  async unsubscribe(user: AuthUser, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: user.userId, householdId: user.householdId },
    });
    return { enabled: false };
  }

  async dispatch(now = new Date()) {
    const vapidDetails = this.vapidDetails();
    const subscriptions = await this.prisma.pushSubscription.findMany();
    const households = new Map<string, typeof subscriptions>();
    for (const subscription of subscriptions) {
      const group = households.get(subscription.householdId) ?? [];
      group.push(subscription);
      households.set(subscription.householdId, group);
    }
    let sent = 0;
    for (const [householdId, devices] of households) {
      const overview = await this.sleep.overviewForHousehold(householdId);
      const due = dueSleepReminders(overview, now);
      for (const moment of due) {
        for (const device of devices) {
          const claimed = await this.prisma.sleepReminderDelivery.createMany({
            data: [
              {
                subscriptionId: device.id,
                awakeSince: moment.awakeSince,
                leadMinutes: moment.leadMinutes,
                nextSleepAt: moment.nextSleepAt,
              },
            ],
            skipDuplicates: true,
          });
          if (!claimed.count) continue;
          try {
            await webPush.sendNotification(
              {
                endpoint: device.endpoint,
                keys: { p256dh: device.p256dh, auth: device.auth },
              },
              this.payload(moment, overview.timeZone),
              {
                vapidDetails,
                TTL: SLEEP_REMINDER.pushTtlSeconds,
                timeout: SLEEP_REMINDER.pushTimeoutMs,
              },
            );
            sent += 1;
          } catch (error) {
            const status = (error as PushError).statusCode;
            if (status === 404 || status === 410) {
              await this.prisma.pushSubscription.deleteMany({
                where: { id: device.id },
              });
            } else {
              await this.prisma.sleepReminderDelivery.deleteMany({
                where: {
                  subscriptionId: device.id,
                  awakeSince: moment.awakeSince,
                  leadMinutes: moment.leadMinutes,
                },
              });
              this.logger.warn(
                `Push delivery failed with status ${status ?? 'unknown'}`,
              );
            }
          }
        }
      }
    }
    return { sent };
  }

  private payload(moment: ReminderMoment, timeZone: string): string {
    const time = formatClock(moment.nextSleepAt, timeZone);
    const body = moment.leadMinutes
      ? `Орієнтовний початок о ${time}. Залишилось ${moment.leadMinutes} хв.`
      : `Орієнтовний час сну — ${time}.`;
    return JSON.stringify({
      notification: {
        title: moment.leadMinutes ? 'Наближається час сну' : 'Час сну',
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `sleep-${moment.awakeSince.toISOString()}-${moment.leadMinutes}`,
        data: {
          onActionClick: {
            default: {
              operation: 'navigateLastFocusedOrOpen',
              url: SLEEP_REMINDER.publicPath,
            },
          },
        },
      },
    });
  }

  private vapidDetails() {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!subject || !publicKey || !privateKey) {
      throw new ServiceUnavailableException('Push не налаштовано.');
    }
    return { subject, publicKey, privateKey };
  }
}

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password &&
      (host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host.endsWith('.push.apple.com'))
    );
  } catch {
    return false;
  }
}
