import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';
import {
  CreateShoppingItemDto,
  CreateShoppingListDto,
  UpdateShoppingItemDto,
} from './dto/shopping.dto';

@Injectable()
export class ShoppingService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(user: AuthUser) {
    return this.prisma.shoppingItem.findMany({
      where: { list: { householdId: user.householdId } },
      include: {
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
      orderBy: [
        { isChecked: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async createItem(user: AuthUser, dto: CreateShoppingItemDto) {
    const list = dto.listId
      ? await this.prisma.shoppingList.findFirst({
          where: { id: dto.listId, householdId: user.householdId },
        })
      : await this.ensureDefaultList(user);
    if (!list) throw new NotFoundException('Список покупок не знайдено.');
    const max = await this.prisma.shoppingItem.aggregate({
      where: { listId: list.id },
      _max: { sortOrder: true },
    });
    return this.prisma.shoppingItem.create({
      data: {
        listId: list.id,
        createdById: user.userId,
        name: dto.name,
        qty: dto.qty ?? 1,
        unit: dto.unit,
        category: dto.category,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      include: {
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
  }

  listLists(user: AuthUser) {
    return this.prisma.shoppingList.findMany({
      where: { householdId: user.householdId, isDefault: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createList(user: AuthUser, dto: CreateShoppingListDto) {
    const name = dto.name.trim();
    const items = dto.items.map((item) => item.trim()).filter(Boolean);
    if (!name || !items.length || items.some((item) => item.length > 120)) {
      throw new BadRequestException(
        'Вкажіть назву списку та хоча б одну покупку.',
      );
    }
    return this.prisma.shoppingList.create({
      data: {
        householdId: user.householdId,
        name,
        isDefault: false,
        items: {
          create: items.map((item, sortOrder) => ({
            name: item,
            sortOrder,
            createdById: user.userId,
          })),
        },
      },
      include: { items: true },
    });
  }

  async removeList(user: AuthUser, id: string) {
    const list = await this.prisma.shoppingList.findFirst({
      where: { id, householdId: user.householdId, isDefault: false },
    });
    if (!list) throw new NotFoundException('Список покупок не знайдено.');
    await this.prisma.shoppingList.delete({ where: { id } });
    return { ok: true };
  }

  async updateItem(user: AuthUser, id: string, dto: UpdateShoppingItemDto) {
    const item = await this.ensureOwnedItem(user, id);
    if (dto.version !== undefined && dto.version !== item.version) {
      throw new ConflictException('Item was updated elsewhere');
    }
    return this.prisma.shoppingItem.update({
      where: { id },
      data: {
        name: dto.name,
        qty: dto.qty,
        unit: dto.unit === undefined ? undefined : dto.unit,
        category: dto.category === undefined ? undefined : dto.category,
        isChecked: dto.isChecked,
        version: { increment: 1 },
        updatedById: user.userId,
      },
      include: {
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
  }

  async removeItem(user: AuthUser, id: string) {
    await this.ensureOwnedItem(user, id);
    await this.prisma.shoppingItem.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureDefaultList(user: AuthUser) {
    const existing = await this.prisma.shoppingList.findFirst({
      where: { householdId: user.householdId, isDefault: true },
    });
    if (existing) {
      return existing;
    }
    try {
      return await this.prisma.shoppingList.create({
        data: {
          householdId: user.householdId,
          name: 'Окремі покупки',
          isDefault: true,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      const created = await this.prisma.shoppingList.findFirst({
        where: { householdId: user.householdId, isDefault: true },
      });
      if (!created) throw error;
      return created;
    }
  }

  private async ensureOwnedItem(user: AuthUser, id: string) {
    const item = await this.prisma.shoppingItem.findFirst({
      where: { id, list: { householdId: user.householdId } },
    });
    if (!item) {
      throw new NotFoundException('Shopping item not found');
    }
    return item;
  }
}
