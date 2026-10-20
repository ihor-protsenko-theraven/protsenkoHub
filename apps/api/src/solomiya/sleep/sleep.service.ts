import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HOUSEHOLD } from '../../config/household.config';
import type { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSleepDto,
  PauseSleepDto,
  ResumeSleepDto,
  StartSleepDto,
  StopSleepDto,
  UpdatePauseDto,
  UpdateSleepDto,
  UpdateSleepProfileDto,
} from './dto/sleep.dto';
import { SLEEP_TRACKER } from './sleep.config';
import { buildSleepGuidance } from './sleep-guidance';
import { sessionInclude, type SessionRow, type SleepDb } from './sleep.model';
import {
  ageLabelFromDays,
  ASSUMED_AGE_WEEKS,
  calendarAgeDays,
  CLOCK_SKEW_MS,
  MAX_SLEEP_MIN,
  suggestedKind,
} from './sleep-time';

const HISTORY_MS = SLEEP_TRACKER.historyDays * SLEEP_TRACKER.dayMs;

@Injectable()
export class SleepService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthUser) {
    return this.overviewForHousehold(user.householdId);
  }

  /** Reuse the same current guidance for the push dispatcher. */
  async overviewForHousehold(householdId: string) {
    const timeZone = await this.timeZoneOf(householdId);
    const profile = await this.ensureProfile(householdId);
    const active = await this.loadActive(householdId);
    const since = new Date(Date.now() - HISTORY_MS);
    const sessions = await this.prisma.sleepSession.findMany({
      where: {
        householdId,
        OR: [
          { startedAt: { gte: since } },
          { endedAt: null },
          { endedAt: { gte: since } },
        ],
      },
      include: sessionInclude,
      orderBy: { startedAt: 'desc' },
    });
    return this.compose(timeZone, profile, sessions, active);
  }

  async start(user: AuthUser, dto: StartSleepDto) {
    const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();
    this.assertInstant(startedAt, 'Час початку');
    if (
      Date.now() - startedAt.getTime() >
      MAX_SLEEP_MIN * SLEEP_TRACKER.minuteMs
    ) {
      throw new BadRequestException(
        'Активний сон не може починатися раніше ніж 16 годин тому. Додайте завершений запис.',
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await this.findOpen(tx, user.householdId);
        if (current) {
          await tx.activeSleep.upsert({
            where: { householdId: user.householdId },
            create: {
              householdId: user.householdId,
              sessionId: current.id,
            },
            update: { sessionId: current.id },
          });
          return { session: this.map(current), resumed: true as const };
        }
        await this.assertNoOverlap(tx, user.householdId, startedAt, null);
        const kind =
          dto.kind ??
          suggestedKind(startedAt, await this.timeZoneOf(user.householdId));
        const session = await tx.sleepSession.create({
          data: {
            householdId: user.householdId,
            kind,
            startedAt,
            notes: this.cleanNotes(dto.notes),
            startedById: user.userId,
          },
          include: sessionInclude,
        });
        await tx.activeSleep.create({
          data: { householdId: user.householdId, sessionId: session.id },
        });
        return { session: this.map(session), resumed: false as const };
      });
    } catch (error) {
      if (!this.isUnique(error)) throw error;
      const current = await this.findOpen(this.prisma, user.householdId);
      if (!current) throw error;
      return { session: this.map(current), resumed: true as const };
    }
  }

  async stop(user: AuthUser, dto: StopSleepDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOpen(tx, user.householdId);
      if (!current) {
        throw new ConflictException('Зараз немає активного сну.');
      }
      const endedAt = dto.endedAt ? new Date(dto.endedAt) : new Date();
      this.assertRange(current.startedAt, endedAt);
      if (current.pauses.some((pause) => pause.endedAt === null)) {
        await tx.sleepPause.updateMany({
          where: { sessionId: current.id, endedAt: null },
          data: { endedAt },
        });
      }
      const session = await tx.sleepSession.update({
        where: { id: current.id },
        data: {
          endedAt,
          endedById: user.userId,
          notes:
            dto.notes === undefined ? undefined : this.cleanNotes(dto.notes),
        },
        include: sessionInclude,
      });
      await tx.activeSleep.deleteMany({
        where: { householdId: user.householdId },
      });
      return { session: this.map(session) };
    });
  }

  async pause(user: AuthUser, dto: PauseSleepDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOpen(tx, user.householdId);
      if (!current) throw new ConflictException('Зараз немає активного сну.');
      const open = current.pauses.find((pause) => pause.endedAt === null);
      if (open) {
        return { session: this.map(current), alreadyPaused: true as const };
      }
      const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();
      this.assertPauseStart(current, startedAt);
      await tx.sleepPause.create({
        data: { sessionId: current.id, startedAt },
      });
      const fresh = await tx.sleepSession.findFirstOrThrow({
        where: { id: current.id },
        include: sessionInclude,
      });
      return { session: this.map(fresh), alreadyPaused: false as const };
    });
  }

  async resume(user: AuthUser, dto: ResumeSleepDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOpen(tx, user.householdId);
      if (!current) throw new ConflictException('Зараз немає активного сну.');
      const open = current.pauses.find((pause) => pause.endedAt === null);
      if (!open) throw new ConflictException('Паузи зараз немає.');
      const endedAt = dto.endedAt ? new Date(dto.endedAt) : new Date();
      this.assertPauseEnd(open.startedAt, endedAt, current.startedAt);
      await tx.sleepPause.update({
        where: { id: open.id },
        data: { endedAt },
      });
      const fresh = await tx.sleepSession.findFirstOrThrow({
        where: { id: current.id },
        include: sessionInclude,
      });
      return { session: this.map(fresh) };
    });
  }

  async updatePause(user: AuthUser, id: string, dto: UpdatePauseDto) {
    return this.prisma.$transaction(async (tx) => {
      const pause = await tx.sleepPause.findFirst({
        where: { id, session: { householdId: user.householdId } },
        include: { session: { include: sessionInclude } },
      });
      if (!pause) throw new NotFoundException('Паузу не знайдено.');
      const startedAt = dto.startedAt
        ? new Date(dto.startedAt)
        : pause.startedAt;
      const endedAt =
        dto.endedAt === undefined
          ? pause.endedAt
          : dto.endedAt === null
            ? null
            : new Date(dto.endedAt);
      this.assertInstant(startedAt, 'Початок паузи');
      if (startedAt < pause.session.startedAt) {
        throw new BadRequestException('Пауза не може початися раніше за сон.');
      }
      if (pause.session.endedAt && startedAt > pause.session.endedAt) {
        throw new BadRequestException('Пауза має бути всередині сну.');
      }
      if (endedAt)
        this.assertPauseEnd(startedAt, endedAt, pause.session.startedAt);
      if (endedAt === null) {
        const other = pause.session.pauses.find(
          (item) => item.id !== pause.id && item.endedAt === null,
        );
        if (other) throw new ConflictException('Уже є інша відкрита пауза.');
      }
      await tx.sleepPause.update({
        where: { id },
        data: { startedAt, endedAt },
      });
      const fresh = await tx.sleepSession.findFirstOrThrow({
        where: { id: pause.sessionId },
        include: sessionInclude,
      });
      return { session: this.map(fresh) };
    });
  }

  async create(user: AuthUser, dto: CreateSleepDto) {
    const startedAt = new Date(dto.startedAt);
    const endedAt = new Date(dto.endedAt);
    this.assertRange(startedAt, endedAt);
    return this.prisma.$transaction(async (tx) => {
      await this.assertNoOverlap(tx, user.householdId, startedAt, endedAt);
      const session = await tx.sleepSession.create({
        data: {
          householdId: user.householdId,
          kind: dto.kind,
          startedAt,
          endedAt,
          notes: this.cleanNotes(dto.notes),
          startedById: user.userId,
          endedById: user.userId,
        },
        include: sessionInclude,
      });
      return { session: this.map(session) };
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateSleepDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sleepSession.findFirst({
        where: { id, householdId: user.householdId },
        include: sessionInclude,
      });
      if (!existing) throw new NotFoundException('Запис сну не знайдено.');
      const startedAt = dto.startedAt
        ? new Date(dto.startedAt)
        : existing.startedAt;
      const firstPause = existing.pauses[0];
      if (firstPause && startedAt > firstPause.startedAt) {
        throw new BadRequestException('Початок сну має бути раніше за паузу.');
      }
      const endedAt =
        dto.endedAt === undefined
          ? existing.endedAt
          : dto.endedAt === null
            ? null
            : new Date(dto.endedAt);
      if (endedAt) this.assertRange(startedAt, endedAt);
      else this.assertInstant(startedAt, 'Час початку');
      if (
        endedAt === null &&
        Date.now() - startedAt.getTime() >
          MAX_SLEEP_MIN * SLEEP_TRACKER.minuteMs
      ) {
        throw new BadRequestException(
          'Активний сон не може починатися раніше ніж 16 годин тому.',
        );
      }
      await this.assertNoOverlap(tx, user.householdId, startedAt, endedAt, id);
      if (endedAt === null) {
        const other = await tx.sleepSession.findFirst({
          where: {
            householdId: user.householdId,
            endedAt: null,
            id: { not: id },
          },
        });
        if (other) {
          throw new ConflictException('Уже є інший активний сон.');
        }
      }
      const session = await tx.sleepSession.update({
        where: { id },
        data: {
          kind: dto.kind,
          startedAt,
          endedAt,
          notes:
            dto.notes === undefined ? undefined : this.cleanNotes(dto.notes),
          endedById: endedAt && !existing.endedAt ? user.userId : undefined,
        },
        include: sessionInclude,
      });
      if (endedAt === null) {
        await tx.activeSleep.upsert({
          where: { householdId: user.householdId },
          create: { householdId: user.householdId, sessionId: id },
          update: { sessionId: id },
        });
      } else if (!existing.endedAt) {
        await tx.activeSleep.deleteMany({
          where: { householdId: user.householdId, sessionId: id },
        });
      }
      return { session: this.map(session) };
    });
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.sleepSession.findFirst({
      where: { id, householdId: user.householdId },
    });
    if (!existing) throw new NotFoundException('Запис сну не знайдено.');
    await this.prisma.sleepSession.delete({ where: { id } });
    return { ok: true };
  }

  async updateProfile(user: AuthUser, dto: UpdateSleepProfileDto) {
    if (dto.birthDate) this.assertBirth(dto.birthDate);
    const birthDate =
      dto.birthDate === undefined
        ? undefined
        : dto.birthDate
          ? new Date(`${dto.birthDate}T00:00:00.000Z`)
          : null;
    const napTarget = dto.napTarget === undefined ? undefined : dto.napTarget;
    const profile = await this.prisma.sleepProfile.upsert({
      where: { householdId: user.householdId },
      create: {
        householdId: user.householdId,
        birthDate: birthDate ?? null,
        napTarget: napTarget ?? null,
      },
      update: { birthDate, napTarget },
    });
    return {
      birthDate: profile.birthDate
        ? profile.birthDate.toISOString().slice(0, 10)
        : null,
      napTarget: profile.napTarget,
    };
  }

  private compose(
    timeZone: string,
    profile: {
      babyName: string;
      birthDate: Date | null;
      napTarget: number | null;
    },
    sessions: SessionRow[],
    active: SessionRow | null,
  ) {
    const now = new Date();
    const age = this.ageOf(profile, now, timeZone);
    const guidance = buildSleepGuidance({
      now,
      timeZone,
      ageWeeks: age.weeks,
      ageLabel: age.label,
      assumedAge: age.assumed,
      sessions: sessions.map((session) => ({
        id: session.id,
        kind: session.kind,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        pauses: session.pauses.map((pause) => ({
          startedAt: pause.startedAt,
          endedAt: pause.endedAt,
        })),
      })),
      napTarget: profile.napTarget,
    });
    return {
      serverNow: now.toISOString(),
      timeZone,
      profile: {
        babyName: profile.babyName,
        birthDate: age.birthDate,
        ageWeeks: age.weeks,
        ageLabel: age.label,
        assumedAge: age.assumed,
        napTarget: profile.napTarget,
      },
      active: active ? this.map(active) : null,
      sessions: sessions.map((session) => this.map(session)),
      ...guidance,
    };
  }

  /**
   * Reads the household's open sleep. A normal reload only hits the first
   * branch and does not write startedAt.
   */
  private async loadActive(householdId: string): Promise<SessionRow | null> {
    const pointer = await this.prisma.activeSleep.findUnique({
      where: { householdId },
      include: { session: { include: sessionInclude } },
    });
    if (pointer?.session.endedAt === null) return pointer.session;
    if (pointer) {
      await this.prisma.activeSleep.delete({ where: { householdId } });
    }
    const open = await this.prisma.sleepSession.findMany({
      where: { householdId, endedAt: null },
      orderBy: { startedAt: 'desc' },
      include: sessionInclude,
    });
    if (open.length === 0) return null;
    const [current, ...older] = open;
    await this.prisma.$transaction(async (tx) => {
      for (const stale of older) {
        if (stale.startedAt < current.startedAt) {
          await tx.sleepSession.update({
            where: { id: stale.id },
            data: { endedAt: current.startedAt },
          });
        }
      }
      await tx.activeSleep.upsert({
        where: { householdId },
        create: { householdId, sessionId: current.id },
        update: { sessionId: current.id },
      });
    });
    return current;
  }

  private async findOpen(
    client: SleepDb,
    householdId: string,
  ): Promise<SessionRow | null> {
    const pointer = await client.activeSleep.findUnique({
      where: { householdId },
      include: { session: { include: sessionInclude } },
    });
    if (pointer?.session.endedAt === null) return pointer.session;
    if (pointer) {
      await client.activeSleep.delete({ where: { householdId } });
    }
    return client.sleepSession.findFirst({
      where: { householdId, endedAt: null },
      orderBy: { startedAt: 'desc' },
      include: sessionInclude,
    });
  }

  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    householdId: string,
    startedAt: Date,
    endedAt: Date | null,
    excludeId?: string,
  ) {
    const end =
      endedAt ??
      new Date(startedAt.getTime() + MAX_SLEEP_MIN * SLEEP_TRACKER.minuteMs);
    const conflict = await tx.sleepSession.findFirst({
      where: {
        householdId,
        id: excludeId ? { not: excludeId } : undefined,
        startedAt: { lt: end },
        OR: [{ endedAt: null }, { endedAt: { gt: startedAt } }],
      },
    });
    if (conflict) {
      throw new BadRequestException('Цей час перетинається з іншим сном.');
    }
  }

  private async ensureProfile(householdId: string) {
    const existing = await this.prisma.sleepProfile.findUnique({
      where: { householdId },
    });
    if (existing) return existing;
    try {
      return await this.prisma.sleepProfile.create({
        data: { householdId },
      });
    } catch (error) {
      if (!this.isUnique(error)) throw error;
      const created = await this.prisma.sleepProfile.findUnique({
        where: { householdId },
      });
      if (!created) throw error;
      return created;
    }
  }

  private async timeZoneOf(householdId: string): Promise<string> {
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
      select: { timezone: true },
    });
    return household?.timezone || HOUSEHOLD.defaultTimeZone;
  }

  private ageOf(
    profile: { birthDate: Date | null },
    now: Date,
    timeZone: string,
  ) {
    if (!profile.birthDate) {
      return {
        weeks: ASSUMED_AGE_WEEKS,
        label: 'близько 4 місяців',
        assumed: true,
        birthDate: null as string | null,
      };
    }
    const birthDate = profile.birthDate.toISOString().slice(0, 10);
    const days = Math.max(0, calendarAgeDays(birthDate, now, timeZone));
    return {
      weeks: Math.floor(days / 7),
      label: ageLabelFromDays(days),
      assumed: false,
      birthDate,
    };
  }

  private map(session: SessionRow) {
    const pauses = session.pauses ?? [];
    return {
      id: session.id,
      kind: session.kind,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      notes: session.notes,
      startedByName: session.startedBy?.displayName ?? null,
      endedByName: session.endedBy?.displayName ?? null,
      pauses: pauses.map((pause) => ({
        id: pause.id,
        startedAt: pause.startedAt.toISOString(),
        endedAt: pause.endedAt?.toISOString() ?? null,
      })),
    };
  }

  private assertPauseStart(
    session: {
      startedAt: Date;
      endedAt: Date | null;
      pauses: { endedAt: Date | null }[];
    },
    startedAt: Date,
  ) {
    this.assertInstant(startedAt, 'Початок паузи');
    if (startedAt < session.startedAt) {
      throw new BadRequestException('Пауза не може початися раніше за сон.');
    }
    if (session.endedAt && startedAt >= session.endedAt) {
      throw new BadRequestException('Пауза має бути всередині сну.');
    }
    const closed = session.pauses.filter((pause) => pause.endedAt);
    const latest = closed.reduce<Date | null>(
      (max, pause) =>
        !max || (pause.endedAt && pause.endedAt > max) ? pause.endedAt : max,
      null,
    );
    if (latest && startedAt < latest) {
      throw new BadRequestException('Пауза перетинається з попередньою.');
    }
  }

  private assertPauseEnd(startedAt: Date, endedAt: Date, sleepStart: Date) {
    this.assertInstant(endedAt, 'Кінець паузи');
    if (endedAt <= startedAt) {
      throw new BadRequestException(
        'Кінець паузи має бути пізніше за початок.',
      );
    }
    if (startedAt < sleepStart) {
      throw new BadRequestException('Пауза не може початися раніше за сон.');
    }
  }

  private assertRange(startedAt: Date, endedAt: Date) {
    this.assertInstant(startedAt, 'Час початку');
    this.assertInstant(endedAt, 'Час завершення');
    const duration = endedAt.getTime() - startedAt.getTime();
    if (duration < SLEEP_TRACKER.minSessionMs) {
      throw new BadRequestException('Сон має тривати хоча б хвилину.');
    }
    if (duration > MAX_SLEEP_MIN * SLEEP_TRACKER.minuteMs) {
      throw new BadRequestException(
        'Один сон не довший за 16 годин. Перевірте час.',
      );
    }
  }

  private assertInstant(date: Date, label: string) {
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${label} некоректний.`);
    }
    if (date.getTime() > Date.now() + CLOCK_SKEW_MS) {
      throw new BadRequestException(`${label} ще не настав.`);
    }
  }

  private assertBirth(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Некоректна дата народження.');
    }
    const days = (Date.now() - date.getTime()) / SLEEP_TRACKER.dayMs;
    if (days < 0) {
      throw new BadRequestException(
        'Дата народження не може бути в майбутньому.',
      );
    }
    if (days > 366 * 6) {
      throw new BadRequestException(
        'Дата народження надто давня для цього трекера.',
      );
    }
  }

  private cleanNotes(notes: string | null | undefined): string | null {
    const trimmed = notes?.trim();
    return trimmed ? trimmed : null;
  }

  private isUnique(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
