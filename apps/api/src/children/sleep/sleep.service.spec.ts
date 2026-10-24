import { vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import type { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { HouseholdPushService } from '../household-push.service';
import { sessionInclude } from './sleep.model';
import { SleepService } from './sleep.service';

function user(): AuthUser {
  return {
    userId: 'user-1',
    email: 'admin@protsenkohub.local',
    displayName: 'Ігор',
    householdId: 'home-1',
    membershipId: 'member-1',
    role: MemberRole.MEMBER,
    color: '#2F6F5E',
  };
}

function session(startedAt: Date) {
  return {
    id: 'sleep-1',
    kind: 'NAP' as const,
    startedAt,
    endedAt: null,
    notes: null,
    startedBy: { displayName: 'Ігор' },
    endedBy: null,
    pauses: [] as { id: string; startedAt: Date; endedAt: Date | null }[],
  };
}

function createPush(prisma: PrismaService) {
  const push = new HouseholdPushService(prisma);
  const notify = vi.spyOn(push, 'notify').mockResolvedValue({ sent: 0 });
  return { push, notify };
}

describe('SleepService active tracker', () => {
  it('does not replace an open sleep when start is tapped again', async () => {
    const startedAt = new Date('2026-10-19T05:00:00.000Z');
    const current = session(startedAt);
    const createSession = vi.fn();
    const tx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue({ session: current }),
        delete: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn().mockResolvedValue({}),
      },
      sleepSession: {
        findFirst: vi.fn(),
        create: createSession,
      },
    };
    const prisma = {
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;
    const { push, notify } = createPush(prisma);
    const service = new SleepService(prisma, push);

    const result = await service.start(user(), { kind: 'NIGHT' });

    expect(result.resumed).toBe(true);
    expect(result.session.startedAt).toBe(startedAt.toISOString());
    expect(result.session.kind).toBe('NAP');
    expect(createSession).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(tx.activeSleep.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { sessionId: 'sleep-1' },
      }),
    );
  });

  it('stores a new start only when nobody is already tracking sleep', async () => {
    const createSession = vi
      .fn()
      .mockImplementation(({ data }: { data: { startedAt: Date } }) =>
        Promise.resolve({
          id: 'sleep-2',
          kind: 'NAP',
          endedAt: null,
          notes: null,
          startedBy: { displayName: 'Ігор' },
          endedBy: null,
          ...data,
        }),
      );
    const tx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
        create: vi.fn().mockResolvedValue({}),
        upsert: vi.fn(),
      },
      sleepSession: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: createSession,
      },
    };
    const prisma = {
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
      household: { findUnique: vi.fn() },
    } as unknown as PrismaService;
    const { push, notify } = createPush(prisma);
    const service = new SleepService(prisma, push);
    const startedAt = new Date(Date.now() - 5 * 60_000).toISOString();

    const result = await service.start(user(), { kind: 'NAP', startedAt });

    expect(result.resumed).toBe(false);
    expect(result.session.startedAt).toBe(new Date(startedAt).toISOString());
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(tx.activeSleep.create).toHaveBeenCalledWith({
      data: { householdId: 'home-1', sessionId: 'sleep-2' },
    });
    expect(notify).toHaveBeenCalledWith(user(), {
      type: 'sleep-started',
      sessionId: 'sleep-2',
      kind: 'NAP',
    });
  });

  it('closes the same session and keeps its original start', async () => {
    const startedAt = new Date(Date.now() - 40 * 60_000);
    const current = session(startedAt);
    const tx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue({ session: current }),
        delete: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      sleepSession: {
        findFirst: vi.fn(),
        update: vi
          .fn()
          .mockImplementation(({ data }: { data: { endedAt: Date } }) =>
            Promise.resolve({
              ...current,
              endedAt: data.endedAt,
              endedBy: { displayName: 'Сімʼя' },
            }),
          ),
      },
    };
    const prisma = {
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;
    const { push, notify } = createPush(prisma);
    const service = new SleepService(prisma, push);

    const result = await service.stop(user(), {});

    expect(result.session.startedAt).toBe(startedAt.toISOString());
    expect(result.session.endedAt).not.toBeNull();
    expect(tx.sleepSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sleep-1' },
      }),
    );
    expect(notify).toHaveBeenCalledWith(user(), {
      type: 'sleep-stopped',
      sessionId: 'sleep-1',
    });
  });

  it('refuses to stop when the tracker is already idle', async () => {
    const tx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
      sleepSession: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;
    const { push, notify } = createPush(prisma);
    const service = new SleepService(prisma, push);

    await expect(service.stop(user(), {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps the same pause when pause is tapped again', async () => {
    const startedAt = new Date('2026-10-19T05:00:00.000Z');
    const pauseStarted = new Date('2026-10-19T05:10:00.000Z');
    const current = {
      ...session(startedAt),
      pauses: [{ id: 'pause-1', startedAt: pauseStarted, endedAt: null }],
    };
    const createPause = vi.fn();
    const tx = {
      activeSleep: {
        findUnique: vi.fn().mockResolvedValue({ session: current }),
        delete: vi.fn(),
      },
      sleepSession: { findFirst: vi.fn() },
      sleepPause: { create: createPause },
    };
    const prisma = {
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;
    const { push } = createPush(prisma);
    const service = new SleepService(prisma, push);

    const result = await service.pause(user(), {});

    expect(result.alreadyPaused).toBe(true);
    expect(result.session.startedAt).toBe(startedAt.toISOString());
    expect(result.session.pauses[0]?.startedAt).toBe(
      pauseStarted.toISOString(),
    );
    expect(createPause).not.toHaveBeenCalled();
  });
});

describe('SleepService saved pauses', () => {
  const start = new Date('2026-10-19T10:00:00.000Z');
  const end = new Date('2026-10-19T12:00:00.000Z');
  const existing = {
    ...session(start),
    endedAt: end,
    pauses: [
      {
        id: 'pause-1',
        startedAt: new Date('2026-10-19T10:30:00.000Z'),
        endedAt: new Date('2026-10-19T10:45:00.000Z'),
      },
    ],
  };

  it('adds a bounded pause to a completed household sleep', async () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = {
      sleepSession: {
        findFirst: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({
          ...existing,
          pauses: [
            ...existing.pauses,
            {
              id: 'pause-2',
              startedAt: new Date('2026-10-19T11:00:00.000Z'),
              endedAt: new Date('2026-10-19T11:15:00.000Z'),
            },
          ],
        }),
      },
      sleepPause: { create },
    };
    const prisma = {
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;
    const { push } = createPush(prisma);
    const result = await new SleepService(prisma, push).createSavedPause(
      user(),
      'sleep-1',
      {
        startedAt: '2026-10-19T11:00:00.000Z',
        endedAt: '2026-10-19T11:15:00.000Z',
      },
    );
    expect(create).toHaveBeenCalledOnce();
    expect(result.session.pauses).toHaveLength(2);
    expect(tx.sleepSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'sleep-1', householdId: 'home-1', endedAt: { not: null } },
      include: sessionInclude,
    });
  });

  it('rejects a pause overlapping an existing pause', async () => {
    const create = vi.fn();
    const tx = {
      sleepSession: { findFirst: vi.fn().mockResolvedValue(existing) },
      sleepPause: { create },
    };
    const prisma = {
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;
    const { push } = createPush(prisma);
    await expect(
      new SleepService(prisma, push).createSavedPause(user(), 'sleep-1', {
        startedAt: '2026-10-19T10:40:00.000Z',
        endedAt: '2026-10-19T11:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('SleepService profile', () => {
  it('keeps a legacy installed PWA child update available to the migration trigger', async () => {
    const birthDate = new Date('2026-06-15T00:00:00.000Z');
    const upsert = vi.fn().mockResolvedValue({ napTarget: null });
    const prisma = {
      household: {
        findUnique: vi.fn().mockResolvedValue({ timeZone: 'Europe/Kyiv' }),
      },
      sleepProfile: { upsert },
    } as unknown as PrismaService;
    const { push } = createPush(prisma);
    const service = new SleepService(prisma, push);

    await service.updateProfile(user(), {
      babyName: ' Марко ',
      birthDate: '2026-06-15',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { householdId: 'home-1' },
      create: {
        householdId: 'home-1',
        babyName: 'Марко',
        birthDate,
        napTarget: null,
        updatedById: 'user-1',
      },
      update: {
        babyName: 'Марко',
        birthDate,
        napTarget: undefined,
        updatedById: 'user-1',
      },
    });
    await expect(
      service.updateProfile(user(), { birthDate: '2026-02-30' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('reads the family child for sleep guidance and keeps nap settings separate', async () => {
    const birthDate = new Date('2025-08-23T00:00:00.000Z');
    const upsert = vi.fn().mockResolvedValue({ napTarget: 3 });
    const prisma = {
      household: {
        findUnique: vi.fn().mockResolvedValue({ timeZone: 'Europe/Kyiv' }),
      },
      sleepProfile: {
        upsert,
        findUnique: vi.fn().mockResolvedValue({ napTarget: 3 }),
      },
      childProfile: {
        findUnique: vi.fn().mockResolvedValue({
          name: 'Марко',
          birthDate,
          updatedBy: { displayName: 'Ігор' },
        }),
      },
      activeSleep: { findUnique: vi.fn().mockResolvedValue(null) },
      sleepSession: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const { push } = createPush(prisma);
    const service = new SleepService(prisma, push);
    const saved = await service.updateProfile(user(), { napTarget: 3 });
    const overview = await service.overview(user());

    expect(upsert).toHaveBeenCalledWith({
      where: { householdId: 'home-1' },
      create: {
        householdId: 'home-1',
        napTarget: 3,
        updatedById: 'user-1',
      },
      update: {
        napTarget: 3,
        updatedById: 'user-1',
      },
    });
    expect(saved.napTarget).toBe(3);
    expect(overview.profile.babyName).toBe('Марко');
    expect(overview.profile.birthDate).toBe('2025-08-23');
    expect(overview.profile.assumedAge).toBe(false);
    expect(overview.profile.ageLabel).toContain('1 р.');
  });
});
