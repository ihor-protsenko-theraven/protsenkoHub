import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MemberRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';
import { webAccessTokenPayload } from './auth.model';
import { HOUSEHOLD } from '../config/household.config';
import {
  ageLabelFromDays,
  calendarAgeDays,
} from '../children/sleep/sleep-time';
import { INVITATION } from './invitation.config';
import type { SaveFamilyChildDto } from './dto/family-child.dto';
import type {
  CreateInvitationDto,
  RegisterInvitedDto,
} from './dto/invitation.dto';

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async family(user: AuthUser) {
    const household = await this.prisma.household.findUniqueOrThrow({
      where: { id: user.householdId },
      select: {
        name: true,
        timezone: true,
        childProfile: {
          select: {
            name: true,
            birthDate: true,
            updatedBy: { select: { displayName: true } },
          },
        },
        members: {
          select: {
            id: true,
            displayName: true,
            role: true,
            user: { select: { email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        invitations: {
          where: {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            email: true,
            expiresAt: true,
            createdBy: { select: { displayName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    const birthDate = household.childProfile?.birthDate
      ? household.childProfile.birthDate.toISOString().slice(0, 10)
      : null;
    const timeZone = household.timezone || HOUSEHOLD.defaultTimeZone;
    const days = birthDate
      ? Math.max(0, calendarAgeDays(birthDate, new Date(), timeZone))
      : null;
    return {
      name: household.name,
      child: household.childProfile
        ? {
            name: household.childProfile.name,
            birthDate,
            ageLabel: days !== null ? ageLabelFromDays(days) : null,
            updatedByName:
              household.childProfile.updatedBy?.displayName ?? null,
          }
        : null,
      members: household.members.map(({ user: account, ...member }) => ({
        ...member,
        email: account.email,
      })),
      invitations: household.invitations,
    };
  }

  async saveFamilyChild(user: AuthUser, dto: SaveFamilyChildDto) {
    const name = dto.name.trim();
    const birthDate = new Date(`${dto.birthDate}T00:00:00.000Z`);
    if (
      !name ||
      !Number.isFinite(birthDate.getTime()) ||
      birthDate.toISOString().slice(0, 10) !== dto.birthDate
    ) {
      throw new BadRequestException(
        'Вкажіть коректні ім’я та дату народження дитини.',
      );
    }
    const household = await this.prisma.household.findUniqueOrThrow({
      where: { id: user.householdId },
      select: { timezone: true },
    });
    if (
      calendarAgeDays(
        dto.birthDate,
        new Date(),
        household.timezone || HOUSEHOLD.defaultTimeZone,
      ) < 0
    ) {
      throw new BadRequestException(
        'Дата народження не може бути в майбутньому.',
      );
    }
    const child = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.childProfile.upsert({
        where: { householdId: user.householdId },
        create: {
          householdId: user.householdId,
          name,
          birthDate,
          updatedById: user.userId,
        },
        update: { name, birthDate, updatedById: user.userId },
      });
      // An installed older PWA or a rolled-back API still reads SleepProfile.
      await tx.sleepProfile.upsert({
        where: { householdId: user.householdId },
        create: {
          householdId: user.householdId,
          babyName: name,
          birthDate,
          updatedById: user.userId,
        },
        update: { babyName: name, birthDate, updatedById: user.userId },
      });
      return saved;
    });
    return {
      id: child.id,
      name: child.name,
      birthDate: child.birthDate?.toISOString().slice(0, 10) ?? null,
    };
  }

  async create(user: AuthUser, dto: CreateInvitationDto) {
    this.requireAdmin(user);
    const memberCount = await this.prisma.membership.count({
      where: { householdId: user.householdId },
    });
    if (memberCount >= INVITATION.maxMembers)
      throw new ConflictException('У родині вже є два учасники.');
    const email = dto.email.trim().toLowerCase();
    const member = await this.prisma.membership.findFirst({
      where: { householdId: user.householdId, user: { email } },
    });
    if (member) throw new ConflictException('Цей користувач уже в родині.');
    const token = randomBytes(INVITATION.tokenBytes).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITATION.lifetimeMs);
    await this.prisma.$transaction(async (tx) => {
      await tx.householdInvitation.updateMany({
        where: {
          householdId: user.householdId,
          email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await tx.householdInvitation.create({
        data: {
          householdId: user.householdId,
          createdById: user.userId,
          email,
          tokenHash: hashToken(token),
          expiresAt,
        },
      });
    });
    return { token, expiresAt };
  }

  async revoke(user: AuthUser, id: string) {
    this.requireAdmin(user);
    const result = await this.prisma.householdInvitation.updateMany({
      where: {
        id,
        householdId: user.householdId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Запрошення не знайдено.');
    return { ok: true };
  }

  async preview(token: string) {
    const invitation = await this.validInvitation(token);
    return {
      email: invitation.email,
      householdName: invitation.household.name,
      expiresAt: invitation.expiresAt,
    };
  }

  async accept(
    user: AuthUser,
    token: string,
  ): Promise<{ token: string; user: AuthUser }> {
    const invitation = await this.validInvitation(token);
    if (invitation.email !== user.email.toLowerCase()) {
      throw new ForbiddenException(
        'Увійдіть з адресою, на яку надіслано запрошення.',
      );
    }
    const membership = await this.prisma.$transaction(
      async (tx) => {
        await ensureSpace(tx, invitation.householdId);
        await claimInvitation(tx, invitation.id);
        const joined = await tx.membership.upsert({
          where: {
            userId_householdId: {
              userId: user.userId,
              householdId: invitation.householdId,
            },
          },
          create: {
            userId: user.userId,
            householdId: invitation.householdId,
            role: MemberRole.MEMBER,
            displayName: user.displayName,
          },
          update: {},
        });
        await tx.user.update({
          where: { id: user.userId },
          data: { activeHouseholdId: invitation.householdId },
        });
        await tx.pushSubscription.updateMany({
          where: { userId: user.userId },
          data: { householdId: invitation.householdId },
        });
        return joined;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    const next: AuthUser = {
      ...user,
      householdId: membership.householdId,
      membershipId: membership.id,
      role: membership.role,
      color: membership.color,
      displayName: membership.displayName,
    };
    return {
      token: await this.jwt.signAsync(webAccessTokenPayload(next)),
      user: next,
    };
  }

  async register(
    token: string,
    dto: RegisterInvitedDto,
  ): Promise<{ token: string; user: AuthUser }> {
    const invitation = await this.validInvitation(token);
    const existing = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existing)
      throw new ConflictException(
        'Акаунт уже існує. Увійдіть і прийміть запрошення.',
      );
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const joined = await this.prisma.$transaction(
      async (tx) => {
        await ensureSpace(tx, invitation.householdId);
        await claimInvitation(tx, invitation.id);
        const account = await tx.user.create({
          data: {
            email: invitation.email,
            displayName: dto.displayName.trim(),
            passwordHash,
            activeHouseholdId: invitation.householdId,
          },
        });
        const membership = await tx.membership.create({
          data: {
            userId: account.id,
            householdId: invitation.householdId,
            role: MemberRole.MEMBER,
            displayName: account.displayName,
          },
        });
        return { account, membership };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    const user: AuthUser = {
      userId: joined.account.id,
      email: joined.account.email,
      displayName: joined.membership.displayName,
      householdId: joined.membership.householdId,
      membershipId: joined.membership.id,
      role: joined.membership.role,
      color: joined.membership.color,
    };
    return {
      token: await this.jwt.signAsync(webAccessTokenPayload(user)),
      user,
    };
  }

  private async validInvitation(token: string) {
    const invitation = await this.prisma.householdInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { household: { select: { name: true } } },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BadRequestException(
        'Запрошення недійсне або термін його дії минув.',
      );
    }
    return invitation;
  }

  private requireAdmin(user: AuthUser): void {
    if (user.role !== MemberRole.ADMIN)
      throw new ForbiddenException(
        'Лише адміністратор родини може запрошувати.',
      );
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function claimInvitation(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<void> {
  const claimed = await tx.householdInvitation.updateMany({
    where: {
      id,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { acceptedAt: new Date() },
  });
  if (!claimed.count)
    throw new ConflictException('Запрошення вже використано.');
}

async function ensureSpace(
  tx: Prisma.TransactionClient,
  householdId: string,
): Promise<void> {
  const count = await tx.membership.count({ where: { householdId } });
  if (count >= INVITATION.maxMembers)
    throw new ConflictException('У родині вже є два учасники.');
}
