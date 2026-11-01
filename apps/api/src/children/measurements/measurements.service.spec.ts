import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/types';
import type { PrismaService } from '../../prisma/prisma.service';
import { MeasurementsService } from './measurements.service';

const testUser: AuthUser = {
  userId: 'user-1',
  email: 'parent@example.com',
  displayName: 'Тато',
  householdId: 'household-1',
  role: 'ADMIN',
};

describe('MeasurementsService', () => {
  let service: MeasurementsService;
  let prisma: {
    childProfile: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    childMeasurement: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      childProfile: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      childMeasurement: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new MeasurementsService(prisma as unknown as PrismaService);
  });

  it('lists measurements and includes child profile info', async () => {
    prisma.childProfile.findUnique.mockResolvedValue({
      id: 'child-1',
      householdId: 'household-1',
      name: 'Соломія',
      birthDate: new Date('2026-05-15T00:00:00.000Z'),
    });
    prisma.childMeasurement.findMany.mockResolvedValue([
      {
        id: 'meas-1',
        childId: 'child-1',
        measuredAt: new Date('2026-11-01T08:00:00.000Z'),
        weightKg: 8.5,
        heightCm: 71,
        headCircumferenceCm: 43.5,
        notes: 'Плановий огляд',
        createdBy: { displayName: 'Тато' },
        createdAt: new Date('2026-11-01T08:05:00.000Z'),
        updatedAt: new Date('2026-11-01T08:05:00.000Z'),
      },
    ]);

    const result = await service.list(testUser);

    expect(result.child).toEqual({
      id: 'child-1',
      name: 'Соломія',
      birthDate: '2026-05-15',
    });
    expect(result.measurements).toHaveLength(1);
    expect(result.measurements[0].weightKg).toBe(8.5);
    expect(result.measurements[0].createdByName).toBe('Тато');
  });

  it('creates measurement successfully when at least one metric is provided', async () => {
    prisma.childProfile.findUnique.mockResolvedValue({
      id: 'child-1',
      householdId: 'household-1',
      name: 'Соломія',
      birthDate: null,
    });
    prisma.childMeasurement.create.mockResolvedValue({
      id: 'meas-1',
      childId: 'child-1',
      measuredAt: new Date('2026-11-01T00:00:00.000Z'),
      weightKg: 8.5,
      heightCm: null,
      headCircumferenceCm: null,
      notes: null,
      createdBy: { displayName: 'Тато' },
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    });

    const result = await service.create(testUser, {
      measuredAt: '2026-11-01T00:00:00.000Z',
      weightKg: 8.5,
    });

    expect(result.id).toBe('meas-1');
    expect(result.weightKg).toBe(8.5);
    expect(prisma.childMeasurement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          householdId: 'household-1',
          childId: 'child-1',
          weightKg: 8.5,
        }),
      }),
    );
  });

  it('throws BadRequestException when no metrics are provided during creation', async () => {
    await expect(
      service.create(testUser, {
        measuredAt: '2026-11-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when updating non-existent measurement', async () => {
    prisma.childMeasurement.findFirst.mockResolvedValue(null);

    await expect(
      service.update(testUser, 'meas-missing', {
        weightKg: 9.0,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates measurement with new values', async () => {
    prisma.childMeasurement.findFirst.mockResolvedValue({
      id: 'meas-1',
      householdId: 'household-1',
      childId: 'child-1',
      measuredAt: new Date('2026-11-01T00:00:00.000Z'),
      weightKg: 8.5,
      heightCm: 70,
      headCircumferenceCm: null,
      notes: null,
    });
    prisma.childMeasurement.update.mockResolvedValue({
      id: 'meas-1',
      childId: 'child-1',
      measuredAt: new Date('2026-11-01T00:00:00.000Z'),
      weightKg: 8.7,
      heightCm: 70,
      headCircumferenceCm: null,
      notes: 'Оновлено',
      createdBy: { displayName: 'Тато' },
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-01T01:00:00.000Z'),
    });

    const result = await service.update(testUser, 'meas-1', {
      weightKg: 8.7,
      notes: 'Оновлено',
    });

    expect(result.weightKg).toBe(8.7);
    expect(result.notes).toBe('Оновлено');
  });

  it('throws NotFoundException when removing non-existent measurement', async () => {
    prisma.childMeasurement.findFirst.mockResolvedValue(null);

    await expect(service.remove(testUser, 'meas-missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removes measurement successfully', async () => {
    prisma.childMeasurement.findFirst.mockResolvedValue({
      id: 'meas-1',
      householdId: 'household-1',
    });
    prisma.childMeasurement.delete.mockResolvedValue({});

    await service.remove(testUser, 'meas-1');

    expect(prisma.childMeasurement.delete).toHaveBeenCalledWith({
      where: { id: 'meas-1' },
    });
  });
});
