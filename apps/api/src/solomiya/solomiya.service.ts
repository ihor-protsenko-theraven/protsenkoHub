import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class SolomiyaService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, status?: TaskStatus) {
    return this.prisma.solomiyaTask.findMany({
      where: {
        householdId: user.householdId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueAt: 'asc' }],
    });
  }

  create(user: AuthUser, dto: CreateTaskDto) {
    return this.prisma.solomiyaTask.create({
      data: {
        householdId: user.householdId,
        title: dto.title,
        notes: dto.notes,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority ?? 0,
        assigneeId: dto.assigneeId,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateTaskDto) {
    await this.ensureOwned(user, id);
    return this.prisma.solomiyaTask.update({
      where: { id },
      data: {
        title: dto.title,
        notes: dto.notes === undefined ? undefined : dto.notes,
        dueAt:
          dto.dueAt === undefined
            ? undefined
            : dto.dueAt
              ? new Date(dto.dueAt)
              : null,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId === undefined ? undefined : dto.assigneeId,
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.ensureOwned(user, id);
    await this.prisma.solomiyaTask.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureOwned(user: AuthUser, id: string) {
    const task = await this.prisma.solomiyaTask.findFirst({
      where: { id, householdId: user.householdId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }
}
