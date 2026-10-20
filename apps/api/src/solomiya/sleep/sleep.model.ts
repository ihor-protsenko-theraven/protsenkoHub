import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export const sessionInclude = {
  startedBy: { select: { displayName: true } },
  endedBy: { select: { displayName: true } },
  pauses: { orderBy: { startedAt: 'asc' as const } },
} satisfies Prisma.SleepSessionInclude;

export type SessionRow = Prisma.SleepSessionGetPayload<{
  include: typeof sessionInclude;
}>;

export type SleepDb = Prisma.TransactionClient | PrismaService;
