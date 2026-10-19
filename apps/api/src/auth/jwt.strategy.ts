import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types';

interface JwtPayload {
  sub: string;
  email: string;
}

function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  if (cookies?.access_token) {
    return cookies.access_token;
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId: payload.sub },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      throw new UnauthorizedException('No household membership');
    }

    return {
      userId: membership.userId,
      email: membership.user.email,
      displayName: membership.displayName,
      householdId: membership.householdId,
      membershipId: membership.id,
      role: membership.role,
      color: membership.color,
    };
  }
}
