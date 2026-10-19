import { NotFoundException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { ShoppingService } from './shopping.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';

describe('ShoppingService household access', () => {
  it('does not delete an item outside the current household', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const remove = jest.fn();
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
