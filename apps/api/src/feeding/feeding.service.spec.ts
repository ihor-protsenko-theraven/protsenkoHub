import { NotFoundException } from '@nestjs/common';
import { FeedingStatus, MemberRole } from '@prisma/client';
import { vi } from 'vitest';
import type { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { FeedingService } from './feeding.service';

const user: AuthUser = {
  userId: 'parent-1',
  email: 'parent@example.com',
  displayName: 'Parent',
  householdId: 'household-1',
  membershipId: 'membership-1',
  role: MemberRole.MEMBER,
  color: '#000000',
};

const child = {
  id: 'child-1',
  householdId: 'household-1',
  name: 'Дитина',
  birthDate: null,
  updatedById: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('FeedingService household access', () => {
  it('returns the shared dictionary without household fields', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'cat-vegetables',
        name: 'Овочі',
        sortOrder: 1,
        items: [
          {
            id: 'food-zucchini',
            categoryId: 'cat-vegetables',
            name: 'Кабачок',
            allowedFromAgeMonths: 6,
            preparationGuide: 'На парі.',
            isAllergen: false,
            sortOrder: 1,
          },
        ],
      },
    ]);
    const transaction = vi.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    const service = new FeedingService({
      foodCategory: { findMany, upsert: vi.fn().mockResolvedValue({}) },
      foodItem: { upsert: vi.fn().mockResolvedValue({}) },
      $transaction: transaction,
    } as unknown as PrismaService);

    const first = await service.dictionary();
    const second = await service.dictionary();

    expect(first).toEqual([
      {
        id: 'cat-vegetables',
        name: 'Овочі',
        items: [
          {
            id: 'food-zucchini',
            categoryId: 'cat-vegetables',
            name: 'Кабачок',
            allowedFromAgeMonths: 6,
            preparationGuide: 'На парі.',
            isAllergen: false,
          },
        ],
      },
    ]);
    expect(second).toEqual(first);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  it('returns an empty tracker when the household has no child', async () => {
    const findMany = vi.fn();
    const service = new FeedingService({
      childProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      feedingRecord: { findMany },
    } as unknown as PrismaService);

    await expect(service.records(user)).resolves.toEqual({
      child: null,
      records: [],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects a child from another household', async () => {
    const findMany = vi.fn();
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new FeedingService({
      childProfile: { findFirst },
      feedingRecord: { findMany },
    } as unknown as PrismaService);

    await expect(service.records(user, 'other-child')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'other-child', householdId: 'household-1' },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('upserts a record only for the household child', async () => {
    const saved = {
      id: 'record-1',
      childId: 'child-1',
      foodItemId: 'food-zucchini',
      status: FeedingStatus.INTRODUCED,
      notes: 'з’їв ложку',
      createdAt: new Date('2026-10-28T10:00:00.000Z'),
      updatedAt: new Date('2026-10-28T10:00:00.000Z'),
    };
    const upsert = vi.fn().mockResolvedValue(saved);
    const service = new FeedingService({
      childProfile: { findUnique: vi.fn().mockResolvedValue(child) },
      foodCategory: { upsert: vi.fn().mockResolvedValue({}) },
      foodItem: {
        upsert: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ id: 'food-zucchini' }),
      },
      feedingRecord: { upsert },
      $transaction: vi.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    } as unknown as PrismaService);

    const result = await service.upsert(user, 'food-zucchini', {
      status: FeedingStatus.INTRODUCED,
      notes: '  з’їв ложку  ',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        childId_foodItemId: { childId: 'child-1', foodItemId: 'food-zucchini' },
      },
      create: {
        childId: 'child-1',
        foodItemId: 'food-zucchini',
        status: FeedingStatus.INTRODUCED,
        notes: 'з’їв ложку',
      },
      update: {
        status: FeedingStatus.INTRODUCED,
        notes: 'з’їв ложку',
      },
    });
    expect(result.updatedAt).toBe('2026-10-28T10:00:00.000Z');
    expect(result.notes).toBe('з’їв ложку');
  });

  it('does not write a record for a missing household child', async () => {
    const upsert = vi.fn();
    const service = new FeedingService({
      childProfile: { findFirst: vi.fn().mockResolvedValue(null) },
      feedingRecord: { upsert },
    } as unknown as PrismaService);

    await expect(
      service.upsert(
        user,
        'food-zucchini',
        { status: FeedingStatus.ALLERGY },
        'other-child',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('clears blank notes and keeps omitted notes unchanged', async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: 'record-1',
      childId: 'child-1',
      foodItemId: 'food-zucchini',
      status: FeedingStatus.REFUSED,
      notes: null,
      createdAt: new Date('2026-10-28T10:00:00.000Z'),
      updatedAt: new Date('2026-10-28T10:00:00.000Z'),
    });
    const service = new FeedingService({
      childProfile: { findUnique: vi.fn().mockResolvedValue(child) },
      foodCategory: { upsert: vi.fn().mockResolvedValue({}) },
      foodItem: {
        upsert: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ id: 'food-zucchini' }),
      },
      feedingRecord: { upsert },
      $transaction: vi.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    } as unknown as PrismaService);

    await service.upsert(user, 'food-zucchini', {
      status: FeedingStatus.REFUSED,
      notes: '   ',
    });
    expect(upsert).toHaveBeenLastCalledWith({
      where: {
        childId_foodItemId: { childId: 'child-1', foodItemId: 'food-zucchini' },
      },
      create: {
        childId: 'child-1',
        foodItemId: 'food-zucchini',
        status: FeedingStatus.REFUSED,
        notes: null,
      },
      update: { status: FeedingStatus.REFUSED, notes: null },
    });

    await service.upsert(user, 'food-zucchini', {
      status: FeedingStatus.PENDING,
    });
    expect(upsert).toHaveBeenLastCalledWith({
      where: {
        childId_foodItemId: { childId: 'child-1', foodItemId: 'food-zucchini' },
      },
      create: {
        childId: 'child-1',
        foodItemId: 'food-zucchini',
        status: FeedingStatus.PENDING,
        notes: null,
      },
      update: { status: FeedingStatus.PENDING },
    });
  });
});
