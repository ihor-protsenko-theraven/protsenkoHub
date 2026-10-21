import { vi } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';
import { InvitationService } from './invitation.service';

const parent: AuthUser = {
  userId: 'parent',
  email: 'parent@example.com',
  displayName: 'Тато',
  householdId: 'family',
  membershipId: 'parent-member',
  role: MemberRole.ADMIN,
  color: '#2F6F5E',
};

describe('InvitationService', () => {
  it('creates a one-time invitation for the inviter household', async () => {
    const created: Array<{
      data: { householdId: string; email: string; tokenHash: string };
    }> = [];
    const transaction = {
      householdInvitation: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn(
          (input: {
            data: { householdId: string; email: string; tokenHash: string };
          }) => {
            created.push(input);
            return Promise.resolve({});
          },
        ),
      },
    };
    const prisma = {
      membership: {
        count: vi.fn().mockResolvedValue(1),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new InvitationService(
      prisma as unknown as PrismaService,
      {} as JwtService,
    );

    const result = await service.create(parent, { email: ' MOM@EXAMPLE.COM ' });

    expect(result.token).toBeTruthy();
    expect(created[0]?.data.householdId).toBe('family');
    expect(created[0]?.data.email).toBe('mom@example.com');
    expect(created[0]?.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created[0]?.data.tokenHash).not.toBe(result.token);
  });

  it('rejects acceptance from another email', async () => {
    const prisma = {
      householdInvitation: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'invite',
          email: 'mom@example.com',
          householdId: 'family',
          household: { name: 'Родина' },
          acceptedAt: null,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      $transaction: vi.fn(),
    };
    const service = new InvitationService(
      prisma as unknown as PrismaService,
      {} as JwtService,
    );

    await expect(
      service.accept({ ...parent, email: 'other@example.com' }, 'token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not join when an invitation was already claimed', async () => {
    const transaction = {
      membership: { count: vi.fn().mockResolvedValue(1), upsert: vi.fn() },
      householdInvitation: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      householdInvitation: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'invite',
          email: 'mom@example.com',
          householdId: 'family',
          household: { name: 'Родина' },
          acceptedAt: null,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      $transaction: vi.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new InvitationService(
      prisma as unknown as PrismaService,
      {} as JwtService,
    );

    await expect(
      service.accept({ ...parent, email: 'mom@example.com' }, 'token'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.membership.upsert).not.toHaveBeenCalled();
  });

  it('activates the inviter household for an existing account', async () => {
    const transaction = {
      membership: {
        count: vi.fn().mockResolvedValue(1),
        upsert: vi.fn().mockResolvedValue({
          id: 'new-member',
          householdId: 'family',
          role: MemberRole.MEMBER,
          color: '#2F6F5E',
          displayName: 'Мама',
        }),
      },
      householdInvitation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: vi.fn().mockResolvedValue({}) },
      pushSubscription: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      householdInvitation: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'invite',
          email: 'mom@example.com',
          householdId: 'family',
          household: { name: 'Родина' },
          acceptedAt: null,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      $transaction: vi.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const jwt = { signAsync: vi.fn().mockResolvedValue('signed') };
    const service = new InvitationService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );

    const result = await service.accept(
      {
        ...parent,
        userId: 'mom',
        email: 'mom@example.com',
        displayName: 'Мама',
      },
      'token',
    );

    expect(result.user.householdId).toBe('family');
    expect(result.user.membershipId).toBe('new-member');
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'mom' },
      data: { activeHouseholdId: 'family' },
    });
    expect(transaction.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { userId: 'mom' },
      data: { householdId: 'family' },
    });
  });
});
