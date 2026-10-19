import { Injectable, NotFoundException } from '@nestjs/common';
import { ContactCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, category?: ContactCategory, q?: string) {
    return this.prisma.contact.findMany({
      where: {
        householdId: user.householdId,
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { organization: { contains: q } },
                { notes: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  create(user: AuthUser, dto: CreateContactDto) {
    return this.prisma.contact.create({
      data: {
        householdId: user.householdId,
        name: dto.name,
        category: dto.category ?? ContactCategory.OTHER,
        phone: dto.phone,
        email: dto.email,
        organization: dto.organization,
        notes: dto.notes,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateContactDto) {
    await this.ensureOwned(user, id);
    return this.prisma.contact.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        phone: dto.phone === undefined ? undefined : dto.phone,
        email: dto.email === undefined ? undefined : dto.email,
        organization:
          dto.organization === undefined ? undefined : dto.organization,
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.ensureOwned(user, id);
    await this.prisma.contact.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureOwned(user: AuthUser, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, householdId: user.householdId },
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }
}
