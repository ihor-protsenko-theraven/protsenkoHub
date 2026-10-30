import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertFeedingRecordDto } from './dto/feeding.dto';
import { completedAgeMonths } from './feeding-age';
import { ensureFeedingDictionary } from './feeding-dictionary';
import { pickFeedingFocus } from './feeding-focus';
import type {
  FeedingFocusDto,
  FeedingRecordDto,
  FeedingTrackerDto,
  FoodCategoryDto,
} from './feeding.model';

const categoryInclude = {
  orderBy: { sortOrder: 'asc' as const },
  include: { items: { orderBy: { sortOrder: 'asc' as const } } },
};

type StoredCategory = Prisma.FoodCategoryGetPayload<{
  include: { items: true };
}>;
type StoredRecord = Prisma.FeedingRecordGetPayload<Record<string, never>>;
type StoredChild = Prisma.ChildProfileGetPayload<Record<string, never>>;

@Injectable()
export class FeedingService {
  private dictionaryReady: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async dictionary(): Promise<FoodCategoryDto[]> {
    await this.ensureDictionary();
    const categories = await this.prisma.foodCategory.findMany(categoryInclude);
    return categories.map((category) => this.toCategory(category));
  }

  async focus(user: AuthUser): Promise<FeedingFocusDto> {
    const tracker = await this.records(user);
    if (!tracker.child) {
      return { child: null, introduced: null, current: null, next: null };
    }
    await this.ensureDictionary();
    const categories = await this.prisma.foodCategory.findMany(categoryInclude);
    const picked = pickFeedingFocus(
      categories,
      tracker.records,
      tracker.child.ageMonths,
    );
    return { child: tracker.child, ...picked };
  }

  async records(user: AuthUser, childId?: string): Promise<FeedingTrackerDto> {
    if (childId) {
      const child = await this.findChild(user, childId);
      if (!child) throw new NotFoundException('Дитину не знайдено.');
      return this.trackerFor(user, child);
    }
    const child = await this.prisma.childProfile.findUnique({
      where: { householdId: user.householdId },
    });
    if (!child) return { child: null, records: [] };
    return this.trackerFor(user, child);
  }

  async upsert(
    user: AuthUser,
    foodItemId: string,
    dto: UpsertFeedingRecordDto,
    childId?: string,
  ): Promise<FeedingRecordDto> {
    const child = childId
      ? await this.findChild(user, childId)
      : await this.prisma.childProfile.findUnique({
          where: { householdId: user.householdId },
        });
    if (!child) {
      throw new NotFoundException(
        childId
          ? 'Дитину не знайдено.'
          : 'Спочатку додайте дитину в розділі «Родина».',
      );
    }
    await this.ensureDictionary();
    const food = await this.prisma.foodItem.findUnique({
      where: { id: foodItemId },
    });
    if (!food) throw new NotFoundException('Продукт не знайдено.');
    const notes =
      dto.notes === undefined ? undefined : normalizeNotes(dto.notes);
    const saved = await this.prisma.feedingRecord.upsert({
      where: { childId_foodItemId: { childId: child.id, foodItemId } },
      create: {
        childId: child.id,
        foodItemId,
        status: dto.status,
        notes: notes ?? null,
      },
      update: {
        status: dto.status,
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    return this.toRecord(saved);
  }

  private ensureDictionary(): Promise<void> {
    this.dictionaryReady ??= ensureFeedingDictionary(this.prisma).catch(
      (error: unknown) => {
        this.dictionaryReady = null;
        throw error;
      },
    );
    return this.dictionaryReady;
  }

  private findChild(user: AuthUser, childId: string) {
    return this.prisma.childProfile.findFirst({
      where: { id: childId, householdId: user.householdId },
    });
  }

  private async trackerFor(
    user: AuthUser,
    child: StoredChild,
  ): Promise<FeedingTrackerDto> {
    const records = await this.prisma.feedingRecord.findMany({
      where: { childId: child.id, child: { householdId: user.householdId } },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      child: {
        id: child.id,
        name: child.name,
        birthDate: child.birthDate
          ? child.birthDate.toISOString().slice(0, 10)
          : null,
        ageMonths: child.birthDate ? completedAgeMonths(child.birthDate) : null,
      },
      records: records.map((record) => this.toRecord(record)),
    };
  }

  private toCategory(category: StoredCategory): FoodCategoryDto {
    return {
      id: category.id,
      name: category.name,
      items: category.items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        allowedFromAgeMonths: item.allowedFromAgeMonths,
        preparationGuide: item.preparationGuide,
        isAllergen: item.isAllergen,
      })),
    };
  }

  private toRecord(record: StoredRecord): FeedingRecordDto {
    return {
      id: record.id,
      childId: record.childId,
      foodItemId: record.foodItemId,
      status: record.status,
      notes: record.notes,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

function normalizeNotes(notes: string | null): string | null {
  if (notes === null) return null;
  const trimmed = notes.trim();
  return trimmed.length > 0 ? trimmed : null;
}
