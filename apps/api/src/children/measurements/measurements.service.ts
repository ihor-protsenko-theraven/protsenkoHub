import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMeasurementDto,
  UpdateMeasurementDto,
} from './dto/measurement.dto';
import type {
  MeasurementChildDto,
  MeasurementDto,
  MeasurementsFeedDto,
} from './measurements.model';

type StoredMeasurement = Prisma.ChildMeasurementGetPayload<{
  include: {
    createdBy: {
      select: {
        displayName: true;
      };
    };
  };
}>;

@Injectable()
export class MeasurementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser): Promise<MeasurementsFeedDto> {
    const [child, measurements] = await Promise.all([
      this.prisma.childProfile.findUnique({
        where: { householdId: user.householdId },
      }),
      this.prisma.childMeasurement.findMany({
        where: { householdId: user.householdId },
        orderBy: { measuredAt: 'desc' },
        include: {
          createdBy: {
            select: { displayName: true },
          },
        },
      }),
    ]);

    const childDto: MeasurementChildDto | null = child
      ? {
          id: child.id,
          name: child.name,
          birthDate: child.birthDate
            ? child.birthDate.toISOString().slice(0, 10)
            : null,
        }
      : null;

    return {
      child: childDto,
      measurements: measurements.map((item) => this.toDto(item)),
    };
  }

  async create(
    user: AuthUser,
    dto: CreateMeasurementDto,
  ): Promise<MeasurementDto> {
    if (
      dto.weightKg == null &&
      dto.heightCm == null &&
      dto.headCircumferenceCm == null
    ) {
      throw new BadRequestException(
        'Вкажіть хоча б один показник: вагу, зріст або окружність голови.',
      );
    }

    const measuredAtDate = new Date(dto.measuredAt);
    if (!Number.isFinite(measuredAtDate.getTime())) {
      throw new BadRequestException('Некоректна дата вимірювання.');
    }

    const child = await this.ensureChild(user);

    const created = await this.prisma.childMeasurement.create({
      data: {
        householdId: user.householdId,
        childId: child.id,
        measuredAt: measuredAtDate,
        weightKg: dto.weightKg ?? null,
        heightCm: dto.heightCm ?? null,
        headCircumferenceCm: dto.headCircumferenceCm ?? null,
        notes: dto.notes?.trim() || null,
        createdById: user.userId,
        updatedById: user.userId,
      },
      include: {
        createdBy: {
          select: { displayName: true },
        },
      },
    });

    return this.toDto(created);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateMeasurementDto,
  ): Promise<MeasurementDto> {
    const existing = await this.prisma.childMeasurement.findFirst({
      where: {
        id,
        householdId: user.householdId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Запис вимірювання не знайдено.');
    }

    const nextWeight =
      dto.weightKg !== undefined ? dto.weightKg : existing.weightKg;
    const nextHeight =
      dto.heightCm !== undefined ? dto.heightCm : existing.heightCm;
    const nextHead =
      dto.headCircumferenceCm !== undefined
        ? dto.headCircumferenceCm
        : existing.headCircumferenceCm;

    if (nextWeight == null && nextHeight == null && nextHead == null) {
      throw new BadRequestException(
        'Вимірювання має містити хоча б один показник: вагу, зріст або окружність голови.',
      );
    }

    let measuredAtDate: Date | undefined;
    if (dto.measuredAt !== undefined) {
      measuredAtDate = new Date(dto.measuredAt);
      if (!Number.isFinite(measuredAtDate.getTime())) {
        throw new BadRequestException('Некоректна дата вимірювання.');
      }
    }

    const updated = await this.prisma.childMeasurement.update({
      where: { id },
      data: {
        ...(measuredAtDate ? { measuredAt: measuredAtDate } : {}),
        ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
        ...(dto.heightCm !== undefined ? { heightCm: dto.heightCm } : {}),
        ...(dto.headCircumferenceCm !== undefined
          ? { headCircumferenceCm: dto.headCircumferenceCm }
          : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() || null }
          : {}),
        updatedById: user.userId,
      },
      include: {
        createdBy: {
          select: { displayName: true },
        },
      },
    });

    return this.toDto(updated);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const existing = await this.prisma.childMeasurement.findFirst({
      where: {
        id,
        householdId: user.householdId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Запис вимірювання не знайдено.');
    }

    await this.prisma.childMeasurement.delete({
      where: { id },
    });
  }

  private async ensureChild(user: AuthUser) {
    const existing = await this.prisma.childProfile.findUnique({
      where: { householdId: user.householdId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.childProfile.create({
      data: {
        householdId: user.householdId,
        name: 'Дитина',
        updatedById: user.userId,
      },
    });
  }

  private toDto(item: StoredMeasurement): MeasurementDto {
    return {
      id: item.id,
      childId: item.childId,
      measuredAt: item.measuredAt.toISOString(),
      weightKg: item.weightKg,
      heightCm: item.heightCm,
      headCircumferenceCm: item.headCircumferenceCm,
      notes: item.notes,
      createdByName: item.createdBy?.displayName ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
