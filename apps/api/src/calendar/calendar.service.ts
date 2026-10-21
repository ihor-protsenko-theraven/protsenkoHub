import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, from?: string, to?: string) {
    return this.prisma.event.findMany({
      where: {
        householdId: user.householdId,
        softDeletedAt: null,
        ...(from || to
          ? {
              startsAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        member: { select: { id: true, color: true, displayName: true } },
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async create(user: AuthUser, dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        householdId: user.householdId,
        title: dto.title,
        notes: dto.notes,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        rrule: dto.rrule,
        memberId: dto.memberId ?? user.membershipId,
        createdById: user.userId,
      },
      include: {
        member: { select: { id: true, color: true, displayName: true } },
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateEventDto) {
    await this.ensureOwned(user, id);
    return this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        notes: dto.notes,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        rrule: dto.rrule === undefined ? undefined : dto.rrule,
        memberId: dto.memberId === undefined ? undefined : dto.memberId,
        updatedById: user.userId,
      },
      include: {
        member: { select: { id: true, color: true, displayName: true } },
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.ensureOwned(user, id);
    return this.prisma.event.update({
      where: { id },
      data: { softDeletedAt: new Date() },
    });
  }

  private async ensureOwned(user: AuthUser, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, householdId: user.householdId, softDeletedAt: null },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }
}
