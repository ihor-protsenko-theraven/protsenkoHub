import { ConflictException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { vi } from 'vitest';
import type { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { HouseholdPushService } from '../household-push.service';
import { SleepService } from './sleep.service';

const member: AuthUser = {
  userId: 'parent-1',
  email: 'parent@example.test',
  displayName: 'Ірина',
  householdId: 'family-1',
  membershipId: 'membership-1',
  role: MemberRole.MEMBER,
  color: '#2F6F5E',
};

function makeActionService(
  options: {
    revision?: number;
    paused?: boolean;
    claimCount?: number;
  } = {},
) {
  const current = {
    id: 'sleep-1',
    revision: options.revision ?? 4,
    kind: 'NAP' as const,
    startedAt: new Date(Date.now() - 10 * 60_000),
    endedAt: null,
    pauses: options.paused
      ? [
          {
            id: 'pause-1',
            startedAt: new Date(Date.now() - 60_000),
            endedAt: null,
          },
        ]
      : [],
  };
  const tx = {
    activeSleep: {
      findUnique: vi.fn().mockResolvedValue({ session: current }),
    },
    sleepSession: {
      updateMany: vi.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
    },
    sleepPause: {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn(
        (args: { where: { id: string }; data: { endedAt: Date } }) =>
          Promise.resolve(args),
      ),
    },
  };
  const prisma = {
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  } as unknown as PrismaService;
  const service = new SleepService(prisma, new HouseholdPushService(prisma));
  const snapshot = {
    schemaVersion: 1 as const,
    serverNow: new Date().toISOString(),
    timeZone: 'Europe/Kyiv',
    childName: 'Соломія',
    state: 'idle' as const,
    nextSleepAt: null,
    active: null,
  };
  vi.spyOn(service, 'widgetSnapshot').mockResolvedValue(snapshot);
  return { service, tx, snapshot };
}

describe('SleepService widget action', () => {
  it('claims the expected household session revision before pausing', async () => {
    const { service, tx, snapshot } = makeActionService();

    await expect(
      service.widgetAction(member, {
        action: 'pause',
        expectedSessionId: 'sleep-1',
        expectedRevision: 4,
      }),
    ).resolves.toEqual({ snapshot });

    expect(tx.sleepSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'sleep-1',
        householdId: 'family-1',
        endedAt: null,
        revision: 4,
      },
      data: {
        revision: { increment: 1 },
        updatedById: 'parent-1',
      },
    });
    expect(tx.sleepPause.create).toHaveBeenCalledOnce();
  });

  it('rejects an outdated widget before writing a pause', async () => {
    const { service, tx } = makeActionService({ revision: 5 });

    await expect(
      service.widgetAction(member, {
        action: 'pause',
        expectedSessionId: 'sleep-1',
        expectedRevision: 4,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.sleepSession.updateMany).not.toHaveBeenCalled();
    expect(tx.sleepPause.create).not.toHaveBeenCalled();
  });

  it('rejects a simultaneous action when its revision claim loses', async () => {
    const { service, tx } = makeActionService({ claimCount: 0 });

    await expect(
      service.widgetAction(member, {
        action: 'pause',
        expectedSessionId: 'sleep-1',
        expectedRevision: 4,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.sleepPause.create).not.toHaveBeenCalled();
  });

  it('prevents the web pause route from racing a widget action', async () => {
    const { service, tx } = makeActionService({ claimCount: 0 });

    await expect(service.pause(member, {})).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(tx.sleepPause.create).not.toHaveBeenCalled();
  });

  it('resumes only the currently open pause after claiming the revision', async () => {
    const { service, tx } = makeActionService({ paused: true });

    await service.widgetAction(member, {
      action: 'resume',
      expectedSessionId: 'sleep-1',
      expectedRevision: 4,
    });

    const update = tx.sleepPause.update.mock.calls[0]?.[0];
    expect(update?.where.id).toBe('pause-1');
    expect(update?.data.endedAt).toBeInstanceOf(Date);
  });
});
