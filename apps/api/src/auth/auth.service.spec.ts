import { AuthService } from './auth.service';
import type { AuthUser } from '../common/types';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';

const user: AuthUser = {
  userId: 'parent-1',
  email: 'parent@example.com',
  displayName: 'Мама',
  householdId: 'household-1',
  membershipId: 'member-1',
  role: 'ADMIN',
  color: '#2F6F5E',
};

describe('mobile sessions', () => {
  it('issues a short-lived mobile access token and stores only a hash of the refresh token', async () => {
    const create = vi.fn(
      ({
        data,
      }: {
        data: {
          id: string;
          userId: string;
          refreshTokenHash: string;
          expiresAt: Date;
        };
      }) => Promise.resolve(data),
    );
    const prisma = {
      mobileSession: { create },
    };
    const jwt = {
      signAsync: vi
        .fn<
          (
            payload: Record<string, unknown>,
            options: { expiresIn: number },
          ) => Promise<string>
        >()
        .mockResolvedValueOnce('signed-access-token')
        .mockResolvedValueOnce('signed-widget-token'),
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );

    const result = await service.issueMobileSession(user);

    expect(result.user).toEqual(user);
    expect(result.accessToken).toBe('signed-access-token');
    expect(result.actionCredential.token).toBe('signed-widget-token');
    expect(result.actionCredential.expiresAt).toBe(
      create.mock.calls[0]?.[0].data.expiresAt.toISOString(),
    );
    expect(result.refreshToken).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(result.accessExpiresAt).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(1);
    const stored = create.mock.calls[0]?.[0].data;
    expect(stored?.id).toBe(result.refreshToken.split('.')[0]);
    expect(stored?.userId).toBe(user.userId);
    expect(stored?.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.refreshTokenHash).not.toBe(result.refreshToken);
    expect(jwt.signAsync).toHaveBeenCalledWith(
      {
        sub: user.userId,
        email: user.email,
        typ: 'mobile-access',
        sid: result.refreshToken.split('.')[0],
      },
      { expiresIn: 900 },
    );
    expect(jwt.signAsync.mock.calls[1]?.[0]).toEqual({
      sub: user.userId,
      email: user.email,
      typ: 'widget-action',
      sid: stored?.id,
    });
    const widgetTtl = jwt.signAsync.mock.calls[1]?.[1].expiresIn;
    expect(widgetTtl).toBeGreaterThan(45 * 60);
    expect(widgetTtl).toBeLessThanOrEqual(30 * 24 * 60 * 60);
  });

  it('rotates the refresh token with an atomic match on its previous hash', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const refreshToken = `${id}.${'A'.repeat(43)}`;
    const oldHash = createHash('sha256').update(refreshToken).digest('hex');
    const updateMany = vi.fn(
      (args: {
        where: {
          id: string;
          refreshTokenHash: string;
          revokedAt: null;
          expiresAt: { gt: Date };
        };
        data: { refreshTokenHash: string; expiresAt: Date };
      }) => {
        expect(args.where.id).toBe(id);
        return Promise.resolve({ count: 1 });
      },
    );
    const prisma = {
      mobileSession: {
        findUnique: vi.fn().mockResolvedValue({
          id,
          userId: user.userId,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany,
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: user.userId,
          email: user.email,
          displayName: user.displayName,
          activeHouseholdId: user.householdId,
          memberships: [
            {
              id: user.membershipId,
              householdId: user.householdId,
              role: user.role,
              color: user.color,
              displayName: user.displayName,
            },
          ],
        }),
      },
    };
    const jwt = {
      signAsync: vi
        .fn()
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-widget-token'),
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );

    const result = await service.refreshMobileSession(refreshToken);

    expect(result.user).toEqual(user);
    expect(result.refreshToken).not.toBe(refreshToken);
    expect(result.refreshToken.startsWith(`${id}.`)).toBe(true);
    expect(result.actionCredential.token).toBe('new-widget-token');
    expect(updateMany).toHaveBeenCalledTimes(1);
    const rotation = updateMany.mock.calls[0]?.[0];
    expect(rotation?.where.id).toBe(id);
    expect(rotation?.where.refreshTokenHash).toBe(oldHash);
    expect(rotation?.where.revokedAt).toBeNull();
    expect(rotation?.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(rotation?.data.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rotation?.data.expiresAt).toBeInstanceOf(Date);
    expect(result.actionCredential.expiresAt).toBe(
      rotation?.data.expiresAt.toISOString(),
    );
  });

  it('revokes only the mobile session proven by the current refresh token', async () => {
    const id = '22222222-2222-4222-8222-222222222222';
    const refreshToken = `${id}.${'B'.repeat(43)}`;
    const updateMany = vi.fn(
      (args: {
        where: { id: string; refreshTokenHash: string; revokedAt: null };
        data: { revokedAt: Date };
      }) => {
        expect(args.where.id).toBe(id);
        return Promise.resolve({ count: 1 });
      },
    );
    const prisma = { mobileSession: { updateMany } };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      { signAsync: vi.fn() } as unknown as JwtService,
    );

    await service.revokeMobileSession(refreshToken);

    expect(updateMany).toHaveBeenCalledTimes(1);
    const revocation = updateMany.mock.calls[0]?.[0];
    expect(revocation?.where.id).toBe(id);
    expect(revocation?.where.refreshTokenHash).toBe(
      createHash('sha256').update(refreshToken).digest('hex'),
    );
    expect(revocation?.where.revokedAt).toBeNull();
    expect(revocation?.data.revokedAt).toBeInstanceOf(Date);
  });

  it('reissues a web cookie that does not yet carry the household', async () => {
    const signAsync = vi.fn().mockResolvedValue('upgraded');
    const decode = vi
      .fn()
      .mockReturnValue({ sub: user.userId, email: user.email });
    const service = new AuthService(
      {} as PrismaService,
      { signAsync, decode } as unknown as JwtService,
    );

    await expect(service.upgradeWebToken(user, 'old-token')).resolves.toBe(
      'upgraded',
    );
    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: user.userId,
        householdId: user.householdId,
        membershipId: user.membershipId,
        role: user.role,
      }),
    );
  });

  it('leaves a web cookie that already carries the household', async () => {
    const signAsync = vi.fn();
    const decode = vi.fn().mockReturnValue({
      sub: user.userId,
      email: user.email,
      householdId: user.householdId,
      membershipId: user.membershipId,
      displayName: user.displayName,
      role: user.role,
      color: user.color,
    });
    const service = new AuthService(
      {} as PrismaService,
      { signAsync, decode } as unknown as JwtService,
    );

    await expect(service.upgradeWebToken(user, 'current-token')).resolves.toBe(
      null,
    );
    expect(signAsync).not.toHaveBeenCalled();
  });
});
