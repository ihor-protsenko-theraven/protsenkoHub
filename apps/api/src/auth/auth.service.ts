import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MemberRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import type { AuthUser } from '../common/types';
import { AUTH } from './auth.config';
import {
  authUserFromWebPayload,
  webAccessTokenPayload,
  type JwtPayload,
  type MobileSessionResponse,
} from './auth.model';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ token: string; user: AuthUser }> {
    if (process.env.ALLOW_REGISTRATION === 'false') {
      throw new ForbiddenException('Реєстрація вимкнена.');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          displayName: dto.displayName,
        },
      });

      const household = await tx.household.create({
        data: {
          name: dto.householdName,
          members: {
            create: {
              userId: user.id,
              role: MemberRole.ADMIN,
              displayName: dto.displayName,
              color: '#2F6F5E',
            },
          },
          shoppingLists: {
            create: { name: 'Окремі покупки', isDefault: true },
          },
        },
        include: { members: true },
      });

      const membership = household.members[0];
      return { user, membership };
    });

    const user = this.toAuthUser(result.user, result.membership);
    return { token: await this.sign(user), user };
  }

  async login(dto: LoginDto): Promise<{ token: string; user: AuthUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        memberships: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!user || user.memberships.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const activeMembership = user.memberships.find(
      (membership) => membership.householdId === user.activeHouseholdId,
    );
    const authUser = this.toAuthUser(
      user,
      activeMembership ?? user.memberships[0],
    );
    return { token: await this.sign(authUser), user: authUser };
  }

  me(authUser: AuthUser): AuthUser {
    return authUser;
  }

  upgradeWebToken(
    user: AuthUser,
    currentToken: unknown,
  ): Promise<string | null> {
    if (typeof currentToken !== 'string' || currentToken.length === 0) {
      return Promise.resolve(null);
    }
    const decoded = this.jwt.decode(currentToken);
    if (
      decoded &&
      typeof decoded === 'object' &&
      authUserFromWebPayload(decoded as JwtPayload)
    ) {
      return Promise.resolve(null);
    }
    return this.sign(user);
  }

  async issueMobileSession(user: AuthUser): Promise<MobileSessionResponse> {
    const id = randomUUID();
    const refreshToken = createRefreshToken(id);
    const expiresAt = new Date(Date.now() + AUTH.mobileRefreshTtlMs);
    await this.prisma.mobileSession.create({
      data: {
        id,
        userId: user.userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });
    return this.mobileResponse(user, id, refreshToken, expiresAt);
  }

  async refreshMobileSession(
    refreshToken: string,
  ): Promise<MobileSessionResponse> {
    const id = refreshToken.split('.')[0];
    const session = await this.prisma.mobileSession.findUnique({
      where: { id },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Mobile session expired');
    }

    const account = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { memberships: { orderBy: { createdAt: 'asc' } } },
    });
    const membership =
      account?.memberships.find(
        (item) => item.householdId === account.activeHouseholdId,
      ) ?? account?.memberships[0];
    if (!account || !membership) {
      throw new UnauthorizedException('No household membership');
    }
    const user = this.toAuthUser(account, membership);
    const nextRefreshToken = createRefreshToken(id);
    const expiresAt = new Date(Date.now() + AUTH.mobileRefreshTtlMs);
    const changed = await this.prisma.mobileSession.updateMany({
      where: {
        id,
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: hashToken(nextRefreshToken),
        expiresAt,
      },
    });
    if (changed.count !== 1) {
      throw new UnauthorizedException('Mobile session expired');
    }
    return this.mobileResponse(user, id, nextRefreshToken, expiresAt);
  }

  async revokeMobileSession(refreshToken: string): Promise<void> {
    const id = refreshToken.split('.')[0];
    const revoked = await this.prisma.mobileSession.updateMany({
      where: {
        id,
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) {
      throw new UnauthorizedException('Mobile session expired');
    }
  }

  private async mobileResponse(
    user: AuthUser,
    id: string,
    refreshToken: string,
    sessionExpiresAt: Date,
  ): Promise<MobileSessionResponse> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.userId, email: user.email, typ: 'mobile-access', sid: id },
      { expiresIn: AUTH.mobileAccessTtlSeconds },
    );
    const widgetToken = await this.jwt.signAsync(
      { sub: user.userId, email: user.email, typ: 'widget-action', sid: id },
      {
        expiresIn: Math.max(
          1,
          Math.floor((sessionExpiresAt.getTime() - Date.now()) / 1000),
        ),
      },
    );
    return {
      user,
      accessToken,
      refreshToken,
      accessExpiresAt: new Date(
        Date.now() + AUTH.mobileAccessTtlSeconds * 1000,
      ).toISOString(),
      actionCredential: {
        token: widgetToken,
        expiresAt: sessionExpiresAt.toISOString(),
      },
    };
  }

  private toAuthUser(
    user: { id: string; email: string; displayName: string },
    membership: {
      id: string;
      householdId: string;
      role: MemberRole;
      color: string;
      displayName: string;
    },
  ): AuthUser {
    return {
      userId: user.id,
      email: user.email,
      displayName: membership.displayName || user.displayName,
      householdId: membership.householdId,
      membershipId: membership.id,
      role: membership.role,
      color: membership.color,
    };
  }

  private sign(user: AuthUser): Promise<string> {
    return this.jwt.signAsync(webAccessTokenPayload(user));
  }
}

function createRefreshToken(id: string): string {
  return `${id}.${randomBytes(AUTH.mobileRefreshBytes).toString('base64url')}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
