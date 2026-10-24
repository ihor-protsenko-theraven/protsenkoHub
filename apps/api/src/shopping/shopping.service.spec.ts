import { vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { ShoppingService } from './shopping.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';

describe('ShoppingService household access', () => {
  it('creates a named list with items for the same household', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'list-1' });
    const prisma = { shoppingList: { create } } as unknown as PrismaService;
    const service = new ShoppingService(prisma);
    const member = {
      userId: 'parent-1',
      householdId: 'household-1',
    } as AuthUser;

    await service.createList(member, {
      name: ' До магазину ',
      items: [' Хліб ', 'Молоко'],
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        householdId: 'household-1',
        name: 'До магазину',
        isDefault: false,
        items: {
          create: [
            { name: 'Хліб', sortOrder: 0, createdById: 'parent-1' },
            { name: 'Молоко', sortOrder: 1, createdById: 'parent-1' },
          ],
        },
      },
      include: { items: true },
    });
  });

  it('rejects adding an item to another household list', async () => {
    const create = vi.fn();
    const service = new ShoppingService({
      shoppingList: { findFirst: vi.fn().mockResolvedValue(null) },
      shoppingItem: { create },
    } as unknown as PrismaService);
    const member = {
      userId: 'parent-1',
      householdId: 'household-1',
    } as AuthUser;

    await expect(
      service.createItem(member, { name: 'Хліб', listId: 'other-list' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('records the authenticated member for creation and editing', async () => {
    const user: AuthUser = {
      userId: 'parent-1',
      email: 'parent@example.com',
      displayName: 'Parent',
      householdId: 'household-1',
      membershipId: 'membership-1',
      role: MemberRole.MEMBER,
      color: '#000000',
    };
    const create = vi.fn().mockResolvedValue({ id: 'item-1' });
    const update = vi.fn().mockResolvedValue({ id: 'item-1' });
    const prisma = {
      shoppingList: { findFirst: vi.fn().mockResolvedValue({ id: 'list-1' }) },
      shoppingItem: {
        aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 0 } }),
        findFirst: vi.fn().mockResolvedValue({ id: 'item-1', version: 1 }),
        create,
        update,
      },
    } as unknown as PrismaService;
    const service = new ShoppingService(prisma);

    await service.createItem(user, { name: 'Молоко' });
    await service.updateItem(user, 'item-1', { isChecked: true, version: 1 });

    expect(create).toHaveBeenCalledWith({
      data: {
        listId: 'list-1',
        createdById: 'parent-1',
        name: 'Молоко',
        qty: 1,
        unit: undefined,
        category: undefined,
        sortOrder: 1,
      },
      include: {
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        name: undefined,
        qty: undefined,
        unit: undefined,
        category: undefined,
        isChecked: true,
        version: { increment: 1 },
        updatedById: 'parent-1',
      },
      include: {
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
  });

  it('does not delete an item outside the current household', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const remove = vi.fn();
    const prisma = {
      shoppingItem: { findFirst, delete: remove },
    } as unknown as PrismaService;
    const service = new ShoppingService(prisma);
    const user: AuthUser = {
      userId: 'user-1',
      email: 'user@example.com',
      displayName: 'User',
      householdId: 'household-1',
      membershipId: 'membership-1',
      role: MemberRole.MEMBER,
      color: '#000000',
    };

    await expect(service.removeItem(user, 'other-item')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'other-item', list: { householdId: 'household-1' } },
    });
    expect(remove).not.toHaveBeenCalled();
  });
});
