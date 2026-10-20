import * as webPush from 'web-push';
import { SleepReminderService } from './sleep-reminder.service';

jest.mock('web-push', () => ({
  sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }),
}));

describe('SleepReminderService dispatch', () => {
  const previous = {
    subject: process.env.VAPID_SUBJECT,
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  };

  beforeEach(() => {
    process.env.VAPID_SUBJECT = 'mailto:admin@example.com';
    process.env.VAPID_PUBLIC_KEY = 'public-test-key';
    process.env.VAPID_PRIVATE_KEY = 'private-test-key';
    jest.clearAllMocks();
  });

  afterAll(() => {
    for (const [key, value] of Object.entries({
      VAPID_SUBJECT: previous.subject,
      VAPID_PUBLIC_KEY: previous.publicKey,
      VAPID_PRIVATE_KEY: previous.privateKey,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('claims each reminder per device and awake cycle before sending', async () => {
    const device = {
      id: 'device-1',
      householdId: 'family-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/test',
      p256dh: 'key',
      auth: 'secret',
    };
    const prisma = {
      pushSubscription: { findMany: jest.fn().mockResolvedValue([device]) },
      sleepReminderDelivery: {
        createMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
    };
    const sleep = {
      overviewForHousehold: jest.fn().mockResolvedValue({
        active: null,
        awakeSince: '2026-10-20T09:00:00.000Z',
        nextSleepAt: '2026-10-20T12:00:00.000Z',
        timeZone: 'Europe/Kyiv',
      }),
    };
    const service = new SleepReminderService(prisma as never, sleep as never);
    const now = new Date('2026-10-20T11:40:00.000Z');

    expect(await service.dispatch(now)).toEqual({ sent: 1 });
    expect(await service.dispatch(now)).toEqual({ sent: 0 });
    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);
    expect(prisma.sleepReminderDelivery.createMany).toHaveBeenCalledTimes(2);
  });
});
