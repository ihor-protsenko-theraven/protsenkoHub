import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { HouseholdPushService } from './household-push.service';

@Injectable()
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: HouseholdPushService,
  ) {}

  list(user: AuthUser, status?: TaskStatus) {
    return this.prisma.solomiyaTask.findMany({
      where: {
        householdId: user.householdId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueAt: 'asc' }],
      include: {
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
  }

  listOpen(user: AuthUser) {
    return this.prisma.solomiyaTask.findMany({
      where: this.openFilter(user),
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueAt: 'asc' }],
      include: {
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
  }

  openPreview(user: AuthUser, limit: number) {
    const where = this.openFilter(user);
    return this.prisma.$transaction([
      this.prisma.solomiyaTask.findMany({
        where, take: limit, orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }, { id: 'asc' }],
        select: { id: true, title: true, status: true, priority: true, dueAt: true },
      }),
      this.prisma.solomiyaTask.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private openFilter(user: AuthUser) {
    return { householdId: user.householdId, status: { not: TaskStatus.DONE } };
  }

  async create(user: AuthUser, dto: CreateTaskDto) {
    const task = await this.prisma.solomiyaTask.create({
      data: {
        householdId: user.householdId,
        createdById: user.userId,
        title: dto.title,
        notes: dto.notes,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority ?? 0,
        assigneeId: dto.assigneeId,
      },
      include: {
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
    if (task.status === TaskStatus.DONE) {
      await this.safeNotify(user, task);
    }
    return task;
  }

  async update(user: AuthUser, id: string, dto: UpdateTaskDto) {
    const existing = await this.ensureOwned(user, id);
    const task = await this.prisma.solomiyaTask.update({
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
        updatedById: user.userId,
      },
      include: {
        createdBy: { select: { displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
    if (
      existing.status !== TaskStatus.DONE &&
      task.status === TaskStatus.DONE
    ) {
      await this.safeNotify(user, task);
    }
    return task;
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

  private async safeNotify(
    user: AuthUser,
    task: { readonly id: string; readonly title: string },
  ): Promise<void> {
    try {
      await this.push.notify(user, {
        type: 'task-completed',
        taskId: task.id,
        title: task.title,
      });
    } catch {
      // Push notifications are best-effort and must not fail task mutations.
    }
  }
}
