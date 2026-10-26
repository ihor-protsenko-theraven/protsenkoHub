import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH } from './auth.config';
import { authUserFromWebPayload, type JwtPayload } from './auth.model';
import type { AuthUser } from '../common/types';

function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[AUTH.cookieName];
  if (token) return token;
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
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: JwtPayload): Promise<AuthUser> {
    if (payload.typ === 'widget-action') {
      const allowed =
        (request.method === 'GET' &&
          request.path === AUTH.widgetRoutes.snapshot) ||
        (request.method === 'POST' &&
          request.path === AUTH.widgetRoutes.action);
      if (!allowed) {
        throw new UnauthorizedException('Widget credential is out of scope');
      }
    } else if (payload.typ !== undefined && payload.typ !== 'mobile-access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const webSession = authUserFromWebPayload(payload);
    if (webSession) return webSession;

    if (payload.typ === 'mobile-access' || payload.typ === 'widget-action') {
      const active =
        payload.sid &&
        (await this.prisma.mobileSession.findFirst({
          where: {
            id: payload.sid,
            userId: payload.sub,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        }));
      if (!active) {
        throw new UnauthorizedException('Mobile session expired');
      }
    }
    const account = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        email: true,
        activeHouseholdId: true,
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            userId: true,
            householdId: true,
            role: true,
            color: true,
            displayName: true,
          },
        },
      },
    });
    const membership = account?.activeHouseholdId
      ? account.memberships.find(
          (item) => item.householdId === account.activeHouseholdId,
        )
      : account?.memberships[0];

    if (!account || !membership) {
      throw new UnauthorizedException('No household membership');
    }

    return {
      userId: membership.userId,
      email: account.email,
      displayName: membership.displayName,
      householdId: membership.householdId,
      membershipId: membership.id,
      role: membership.role,
      color: membership.color,
    };
  }
}
