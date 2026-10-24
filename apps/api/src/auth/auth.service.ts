import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MemberRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import type { AuthUser } from '../common/types';

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
    return this.jwt.signAsync({ sub: user.userId, email: user.email });
  }
}
