import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';
import {
  CreateShoppingItemDto,
  UpdateShoppingItemDto,
} from './dto/shopping.dto';

@Injectable()
export class ShoppingService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(user: AuthUser) {
    const list = await this.ensureDefaultList(user);
    return this.prisma.shoppingItem.findMany({
      where: { listId: list.id },
      orderBy: [
        { isChecked: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async createItem(user: AuthUser, dto: CreateShoppingItemDto) {
    const list = await this.ensureDefaultList(user);
    const max = await this.prisma.shoppingItem.aggregate({
      where: { listId: list.id },
      _max: { sortOrder: true },
    });
    return this.prisma.shoppingItem.create({
      data: {
        listId: list.id,
        name: dto.name,
        qty: dto.qty ?? 1,
        unit: dto.unit,
        category: dto.category,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
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
      where: { householdId: user.householdId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.shoppingList.create({
      data: { householdId: user.householdId, name: 'Продукти' },
    });
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
