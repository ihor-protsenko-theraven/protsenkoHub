import { ConflictException } from '@nestjs/common';
import { MemberRole, TaskStatus } from '@prisma/client';
import { vi } from 'vitest';
import * as webPush from 'web-push';
import type { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { HOUSEHOLD_PUSH } from './household-push.config';
import { HouseholdPushService } from './household-push.service';
import { SleepService } from './sleep/sleep.service';
import { ChildrenService } from './children.service';

vi.mock('web-push', () => ({
  sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
}));

function actorUser(): AuthUser {
  return {
    userId: 'parent-1',
    email: 'igor@protsenkohub.local',
    displayName: 'Ігор',
    householdId: 'household-1',
    membershipId: 'member-1',
    role: MemberRole.MEMBER,
    color: '#2F6F5E',
  };
}

function authorDevice() {
  return {
    id: 'sub-author',
    userId: 'parent-1',
    householdId: 'household-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/author',
    p256dh: 'author-key',
    auth: 'author-auth',
  };
}

function otherParentDevice() {
  return {
    id: 'sub-other',
    userId: 'parent-2',
    householdId: 'household-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/other',
    p256dh: 'other-key',
    auth: 'other-auth',
  };
}

function mockPrisma(overrides: Record<string, unknown>): PrismaService {
  return overrides as unknown as PrismaService;
}

describe('HouseholdPushService family events', () => {
  const previousEnv = {
    subject: process.env.VAPID_SUBJECT,
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  };

  beforeEach(() => {
    process.env.VAPID_SUBJECT = 'mailto:admin@example.com';
    process.env.VAPID_PUBLIC_KEY = 'public-test-key';
    process.env.VAPID_PRIVATE_KEY = 'private-test-key';
    vi.clearAllMocks();
  });

  afterAll(() => {
    for (const [key, value] of Object.entries({
      VAPID_SUBJECT: previousEnv.subject,
      VAPID_PUBLIC_KEY: previousEnv.publicKey,
      VAPID_PRIVATE_KEY: previousEnv.privateKey,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('sends push to another household member on new sleep start and skips the author', async () => {
    const startedAt = new Date(Date.now() - 5 * 60_000);
    const findMany = vi
      .fn()
      .mockResolvedValue([authorDevice(), otherParentDevice()]);
    const tx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
        create: vi.fn().mockResolvedValue({}),
        upsert: vi.fn(),
      },
      sleepSession: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'sleep-new',
          kind: 'NAP',
          startedAt,
          endedAt: null,
          notes: null,
          startedBy: { displayName: 'Ігор' },
          endedBy: null,
          pauses: [],
        }),
      },
    };
    const prisma = mockPrisma({
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
      household: { findUnique: vi.fn().mockResolvedValue(null) },
      pushSubscription: { findMany, deleteMany: vi.fn() },
    });
    const push = new HouseholdPushService(prisma);
    const sleep = new SleepService(prisma, push);

    const result = await sleep.start(actorUser(), {
      kind: 'NAP',
      startedAt: startedAt.toISOString(),
    });

    expect(result.resumed).toBe(false);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        householdId: 'household-1',
        userId: { not: 'parent-1' },
      },
    });
    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: otherParentDevice().endpoint,
        keys: { p256dh: 'other-key', auth: 'other-auth' },
      },
      JSON.stringify({
        notification: {
          title: 'Сон почався',
          body: 'Ігор почав денний сон',
          icon: HOUSEHOLD_PUSH.icon,
          tag: 'sleep-start-sleep-new',
          data: {
            onActionClick: {
              default: {
                operation: 'navigateLastFocusedOrOpen',
                url: '/app/sleep',
              },
            },
          },
        },
      }),
      expect.objectContaining({
        TTL: HOUSEHOLD_PUSH.pushTtlSeconds,
        urgency: HOUSEHOLD_PUSH.urgency,
        timeout: HOUSEHOLD_PUSH.pushTimeoutMs,
      }),
    );
  });

  it('does not send push on repeated start when sleep is already open', async () => {
    const startedAt = new Date(Date.now() - 15 * 60_000);
    const findMany = vi.fn().mockResolvedValue([otherParentDevice()]);
    const tx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue({
          session: {
            id: 'sleep-open',
            kind: 'NIGHT',
            startedAt,
            endedAt: null,
            notes: null,
            startedBy: { displayName: 'Ігор' },
            endedBy: null,
            pauses: [],
          },
        }),
        delete: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn().mockResolvedValue({}),
      },
      sleepSession: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };
    const prisma = mockPrisma({
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
      pushSubscription: { findMany, deleteMany: vi.fn() },
    });
    const push = new HouseholdPushService(prisma);
    const sleep = new SleepService(prisma, push);

    const result = await sleep.start(actorUser(), { kind: 'NIGHT' });

    expect(result.resumed).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('sends push on successful stop and stays silent when no sleep is active', async () => {
    const startedAt = new Date(Date.now() - 45 * 60_000);
    const endedAt = new Date();
    const findMany = vi.fn().mockResolvedValue([otherParentDevice()]);
    const activeTx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue({
          session: {
            id: 'sleep-active',
            revision: 0,
            kind: 'NAP',
            startedAt,
            endedAt: null,
            notes: null,
            startedBy: { displayName: 'Ігор' },
            endedBy: null,
            pauses: [],
          },
        }),
        delete: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      sleepSession: {
        findFirst: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          id: 'sleep-active',
          revision: 1,
          kind: 'NAP',
          startedAt,
          endedAt,
          notes: null,
          startedBy: { displayName: 'Ігор' },
          endedBy: { displayName: 'Ігор' },
          pauses: [],
        }),
      },
    };
    const prisma = mockPrisma({
      $transaction: vi.fn((fn: (client: typeof activeTx) => Promise<unknown>) =>
        fn(activeTx),
      ),
      pushSubscription: { findMany, deleteMany: vi.fn() },
    });
    const push = new HouseholdPushService(prisma);
    const sleep = new SleepService(prisma, push);

    await sleep.stop(actorUser(), { endedAt: endedAt.toISOString() });

    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: otherParentDevice().endpoint }),
      JSON.stringify({
        notification: {
          title: 'Сон закінчився',
          body: 'Ігор завершив сон',
          icon: HOUSEHOLD_PUSH.icon,
          tag: 'sleep-stop-sleep-active',
          data: {
            onActionClick: {
              default: {
                operation: 'navigateLastFocusedOrOpen',
                url: '/app/sleep',
              },
            },
          },
        },
      }),
      expect.any(Object),
    );

    vi.clearAllMocks();
    const idleTx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
      sleepSession: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    Object.assign(prisma, {
      $transaction: vi.fn((fn: (client: typeof idleTx) => Promise<unknown>) =>
        fn(idleTx),
      ),
    });

    await expect(sleep.stop(actorUser(), {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('sends push only when a task is created as DONE or transitions into DONE', async () => {
    const findMany = vi.fn().mockResolvedValue([otherParentDevice()]);
    const findFirst = vi.fn();
    const create = vi.fn();
    const update = vi.fn();
    const prisma = mockPrisma({
      solomiyaTask: { findFirst, create, update },
      pushSubscription: { findMany, deleteMany: vi.fn() },
    });
    const push = new HouseholdPushService(prisma);
    const tasks = new ChildrenService(prisma, push);

    create.mockResolvedValueOnce({
      id: 'task-todo',
      title: 'Купити підгузки',
      status: TaskStatus.TODO,
    });
    await tasks.create(actorUser(), { title: 'Купити підгузки' });
    expect(webPush.sendNotification).not.toHaveBeenCalled();

    create.mockResolvedValueOnce({
      id: 'task-done-create',
      title: 'Дати вітамін D',
      status: TaskStatus.DONE,
    });
    await tasks.create(actorUser(), {
      title: 'Дати вітамін D',
      status: TaskStatus.DONE,
    });
    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    findFirst.mockResolvedValueOnce({
      id: 'task-1',
      householdId: 'household-1',
      title: 'Почистити зуби',
      status: TaskStatus.TODO,
    });
    update.mockResolvedValueOnce({
      id: 'task-1',
      title: 'Почистити зуби',
      status: TaskStatus.DONE,
    });
    await tasks.update(actorUser(), 'task-1', { status: TaskStatus.DONE });

    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: otherParentDevice().endpoint }),
      JSON.stringify({
        notification: {
          title: 'Задачу завершено',
          body: 'Ігор: Почистити зуби',
          icon: HOUSEHOLD_PUSH.icon,
          tag: 'task-done-task-1',
          data: {
            onActionClick: {
              default: {
                operation: 'navigateLastFocusedOrOpen',
                url: '/app/children',
              },
            },
          },
        },
      }),
      expect.any(Object),
    );

    vi.clearAllMocks();
    findFirst.mockResolvedValueOnce({
      id: 'task-1',
      householdId: 'household-1',
      title: 'Почистити зуби',
      status: TaskStatus.DONE,
    });
    update.mockResolvedValueOnce({
      id: 'task-1',
      title: 'Почистити зуби ввечері',
      status: TaskStatus.DONE,
    });
    await tasks.update(actorUser(), 'task-1', {
      title: 'Почистити зуби ввечері',
      status: TaskStatus.DONE,
    });
    expect(webPush.sendNotification).not.toHaveBeenCalled();

    findFirst.mockResolvedValueOnce({
      id: 'task-2',
      householdId: 'household-1',
      title: 'Приготувати ванну',
      status: TaskStatus.IN_PROGRESS,
    });
    update.mockResolvedValueOnce({
      id: 'task-2',
      title: 'Приготувати теплу ванну',
      status: TaskStatus.IN_PROGRESS,
    });
    await tasks.update(actorUser(), 'task-2', {
      title: 'Приготувати теплу ванну',
    });
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('keeps saved sleep and task results when web-push fails and cleans up 404/410 subscriptions', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const findMany = vi.fn().mockResolvedValue([otherParentDevice()]);
    const startedAt = new Date(Date.now() - 5 * 60_000);
    const tx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
        create: vi.fn().mockResolvedValue({}),
        upsert: vi.fn(),
      },
      sleepSession: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'sleep-night',
          kind: 'NIGHT',
          startedAt,
          endedAt: null,
          notes: null,
          startedBy: { displayName: 'Ігор' },
          endedBy: null,
          pauses: [],
        }),
      },
    };
    const prisma = mockPrisma({
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
      household: { findUnique: vi.fn().mockResolvedValue(null) },
      solomiyaTask: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-err',
          householdId: 'household-1',
          title: 'Вкласти спати',
          status: TaskStatus.TODO,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'task-err',
          title: 'Вкласти спати',
          status: TaskStatus.DONE,
        }),
      },
      pushSubscription: { findMany, deleteMany },
    });
    const push = new HouseholdPushService(prisma);
    const sleep = new SleepService(prisma, push);
    const tasks = new ChildrenService(prisma, push);

    vi.mocked(webPush.sendNotification).mockRejectedValueOnce({
      statusCode: 410,
    });
    const sleepResult = await sleep.start(actorUser(), {
      kind: 'NIGHT',
      startedAt: startedAt.toISOString(),
    });
    expect(sleepResult.session.id).toBe('sleep-night');
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: 'sub-other' },
    });

    vi.mocked(webPush.sendNotification).mockRejectedValueOnce(
      new Error('network timeout'),
    );
    const taskResult = await tasks.update(actorUser(), 'task-err', {
      status: TaskStatus.DONE,
    });
    expect(taskResult.id).toBe('task-err');
    expect(taskResult.status).toBe(TaskStatus.DONE);
  });
});
