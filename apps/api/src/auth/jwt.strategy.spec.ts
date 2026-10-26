import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';
import { AUTH } from './auth.config';
import type { JwtPayload } from './auth.model';
import { JwtStrategy } from './jwt.strategy';

const widgetPayload: JwtPayload = {
  sub: 'parent-1',
  email: 'parent@example.com',
  typ: 'widget-action',
  sid: 'session-1',
};

function request(method: string, path: string): Request {
  return { method, path } as Request;
}

function setup(
  options: { sessionActive?: boolean; activeHouseholdId?: string } = {},
) {
  const findFirst = vi
    .fn<
      (query: {
        where: {
          id: string;
          userId: string;
          revokedAt: null;
          expiresAt: { gt: Date };
        };
        select: { id: boolean };
      }) => Promise<{ id: string } | null>
    >()
    .mockResolvedValue(
      options.sessionActive === false ? null : { id: 'session-1' },
    );
  const findUnique = vi.fn().mockResolvedValue({
    email: 'parent@example.com',
    activeHouseholdId: options.activeHouseholdId ?? 'household-1',
    memberships: [
      {
        id: 'member-1',
        userId: 'parent-1',
        householdId: 'household-1',
        role: 'ADMIN',
        color: '#2F6F5E',
        displayName: 'Мама',
      },
      {
        id: 'member-2',
        userId: 'parent-1',
        householdId: 'household-2',
        role: 'MEMBER',
        color: '#2F6F5E',
        displayName: 'Мама',
      },
    ],
  });
  const prisma = {
    mobileSession: { findFirst },
    user: { findUnique },
  };
  const strategy = new JwtStrategy(
    { getOrThrow: () => 'jwt-secret' } as unknown as ConfigService,
    prisma as unknown as PrismaService,
  );
  return { strategy, findFirst, findUnique };
}

describe('JWT validation', () => {
  it('uses Bearer before an incidental cookie and still accepts a web cookie without Bearer', () => {
    const { strategy } = setup();
    const extractor = (
      strategy as unknown as {
        _jwtFromRequest: (request: Request) => string | null;
      }
    )._jwtFromRequest;

    expect(
      extractor({
        headers: { authorization: 'Bearer mobile-token' },
        cookies: { access_token: 'web-cookie-token' },
      } as Request),
    ).toBe('mobile-token');
    expect(
      extractor({
        headers: {},
        cookies: { access_token: 'web-cookie-token' },
      } as Request),
    ).toBe('web-cookie-token');
  });

  it('accepts a widget credential only for its exact snapshot and action methods', async () => {
    const { strategy, findFirst } = setup();

    await expect(
      strategy.validate(
        request('GET', AUTH.widgetRoutes.snapshot),
        widgetPayload,
      ),
    ).resolves.toMatchObject({ householdId: 'household-1' });
    await expect(
      strategy.validate(
        request('POST', AUTH.widgetRoutes.action),
        widgetPayload,
      ),
    ).resolves.toMatchObject({ householdId: 'household-1' });
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['GET', '/api/v1/auth/me'],
    ['POST', '/api/v1/children/sleep/start'],
    ['GET', '/api/v1/children/sleep'],
    ['POST', AUTH.widgetRoutes.snapshot],
    ['GET', AUTH.widgetRoutes.action],
    ['GET', `${AUTH.widgetRoutes.snapshot}/another`],
  ])(
    'rejects widget credential on %s %s before any database access',
    async (method, path) => {
      const { strategy, findFirst, findUnique } = setup();

      await expect(
        strategy.validate(request(method, path), widgetPayload),
      ).rejects.toThrow(UnauthorizedException);
      expect(findFirst).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it('rejects a widget credential as soon as its mobile session is revoked', async () => {
    const { strategy, findFirst, findUnique } = setup({ sessionActive: false });

    await expect(
      strategy.validate(
        request('GET', AUTH.widgetRoutes.snapshot),
        widgetPayload,
      ),
    ).rejects.toThrow(UnauthorizedException);

    const query = findFirst.mock.calls[0]?.[0];
    expect(query).toMatchObject({
      where: {
        id: 'session-1',
        userId: 'parent-1',
        revokedAt: null,
      },
      select: { id: true },
    });
    expect(query?.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('uses the current household membership instead of a household claim in the widget token', async () => {
    const { strategy } = setup({ activeHouseholdId: 'household-2' });

    await expect(
      strategy.validate(
        request('POST', AUTH.widgetRoutes.action),
        widgetPayload,
      ),
    ).resolves.toMatchObject({
      userId: 'parent-1',
      householdId: 'household-2',
      membershipId: 'member-2',
    });
    expect(widgetPayload).not.toHaveProperty('householdId');
  });

  it('rejects a mobile access token when its server session is revoked', async () => {
    const { strategy, findFirst } = setup({ sessionActive: false });

    await expect(
      strategy.validate(request('GET', '/api/v1/auth/me'), {
        ...widgetPayload,
        typ: 'mobile-access',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(findFirst).toHaveBeenCalledOnce();
  });

  it('reads a web session from the token and skips the database', async () => {
    const { strategy, findFirst, findUnique } = setup();

    await expect(
      strategy.validate(request('GET', '/api/v1/auth/me'), {
        sub: 'parent-1',
        email: 'parent@example.com',
        householdId: 'household-9',
        membershipId: 'member-9',
        displayName: 'Тато',
        role: 'MEMBER',
        color: '#111111',
      }),
    ).resolves.toEqual({
      userId: 'parent-1',
      email: 'parent@example.com',
      displayName: 'Тато',
      householdId: 'household-9',
      membershipId: 'member-9',
      role: 'MEMBER',
      color: '#111111',
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('preserves web cookie JWT access and rejects unknown token types', async () => {
    const { strategy, findFirst } = setup();

    await expect(
      strategy.validate(request('GET', '/api/v1/auth/me'), {
        sub: 'parent-1',
        email: 'parent@example.com',
      }),
    ).resolves.toMatchObject({ householdId: 'household-1' });
    expect(findFirst).not.toHaveBeenCalled();
    await expect(
      strategy.validate(request('GET', '/api/v1/auth/me'), {
        ...widgetPayload,
        typ: 'unknown' as JwtPayload['typ'],
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
