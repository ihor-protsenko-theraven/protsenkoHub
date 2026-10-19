import { ConflictException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import type { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
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

describe('SleepService active tracker', () => {
  it('does not replace an open sleep when start is tapped again', async () => {
    const startedAt = new Date('2026-10-19T05:00:00.000Z');
    const current = session(startedAt);
    const createSession = jest.fn();
    const tx = {
      activeSleep: {
        findUnique: jest.fn().mockResolvedValue({ session: current }),
        delete: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
      },
      sleepSession: {
        findFirst: jest.fn(),
        create: createSession,
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const service = new SleepService(prisma);

    const result = await service.start(user(), { kind: 'NIGHT' });

    expect(result.resumed).toBe(true);
    expect(result.session.startedAt).toBe(startedAt.toISOString());
    expect(result.session.kind).toBe('NAP');
    expect(createSession).not.toHaveBeenCalled();
    expect(tx.activeSleep.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { sessionId: 'sleep-1' },
      }),
    );
  });

  it('stores a new start only when nobody is already tracking sleep', async () => {
    const createSession = jest.fn().mockImplementation(({ data }: { data: { startedAt: Date } }) =>
      Promise.resolve({
        id: 'sleep-2',
        kind: data.startedAt ? 'NAP' : 'NAP',
        startedAt: data.startedAt,
        endedAt: null,
        notes: null,
        startedBy: { displayName: 'Ігор' },
        endedBy: null,
        ...data,
      }),
    );
    const tx = {
      activeSleep: {
        findUnique: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        upsert: jest.fn(),
      },
      sleepSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: createSession,
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      household: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new SleepService(prisma);
    const startedAt = new Date(Date.now() - 5 * 60_000).toISOString();

    const result = await service.start(user(), { kind: 'NAP', startedAt });

    expect(result.resumed).toBe(false);
    expect(result.session.startedAt).toBe(new Date(startedAt).toISOString());
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(tx.activeSleep.create).toHaveBeenCalledWith({
      data: { householdId: 'home-1', sessionId: 'sleep-2' },
    });
  });

  it('closes the same session and keeps its original start', async () => {
    const startedAt = new Date(Date.now() - 40 * 60_000);
    const current = session(startedAt);
    const tx = {
      activeSleep: {
        findUnique: jest.fn().mockResolvedValue({ session: current }),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      sleepSession: {
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data }: { data: { endedAt: Date } }) =>
          Promise.resolve({
            ...current,
            endedAt: data.endedAt,
            endedBy: { displayName: 'Сімʼя' },
          }),
        ),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const service = new SleepService(prisma);

    const result = await service.stop(user(), {});

    expect(result.session.startedAt).toBe(startedAt.toISOString());
    expect(result.session.endedAt).not.toBeNull();
    expect(tx.sleepSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sleep-1' },
      }),
    );
  });

  it('refuses to stop when the tracker is already idle', async () => {
    const tx = {
      activeSleep: {
        findUnique: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
      },
      sleepSession: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const service = new SleepService(prisma);

    await expect(service.stop(user(), {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps the same pause when pause is tapped again', async () => {
    const startedAt = new Date('2026-10-19T05:00:00.000Z');
    const pauseStarted = new Date('2026-10-19T05:10:00.000Z');
    const current = {
      ...session(startedAt),
      pauses: [{ id: 'pause-1', startedAt: pauseStarted, endedAt: null }],
    };
    const createPause = jest.fn();
    const tx = {
      activeSleep: {
        findUnique: jest.fn().mockResolvedValue({ session: current }),
        delete: jest.fn(),
      },
      sleepSession: { findFirst: jest.fn() },
      sleepPause: { create: createPause },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const service = new SleepService(prisma);

    const result = await service.pause(user(), {});

    expect(result.alreadyPaused).toBe(true);
    expect(result.session.startedAt).toBe(startedAt.toISOString());
    expect(result.session.pauses[0]?.startedAt).toBe(pauseStarted.toISOString());
    expect(createPause).not.toHaveBeenCalled();
  });
});
