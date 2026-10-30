import type { AuthService } from './auth.service';
import type { InvitationService } from './invitation.service';
import { AuthController } from './auth.controller';
import type { AuthUser } from '../common/types';

describe('mobile auth endpoints', () => {
  it('logs in with a mobile session while keeping the web JWT out of the JSON response', async () => {
    const user = { userId: 'parent-1', email: 'parent@example.com' };
    const mobile = {
      user,
      accessToken: 'mobile-access',
      refreshToken: 'mobile-refresh',
      accessExpiresAt: '2026-10-24T08:15:00.000Z',
    };
    const auth = {
      login: vi.fn().mockResolvedValue({ user, token: 'web-cookie-token' }),
      issueMobileSession: vi.fn().mockResolvedValue(mobile),
    };
    const controller = new AuthController(
      auth as unknown as AuthService,
      {} as InvitationService,
    );

    const result = await controller.mobileLogin({
      email: user.email,
      password: 'some-password',
    });

    expect(result).toEqual(mobile);
    expect(auth.issueMobileSession).toHaveBeenCalledWith(user);
    expect(JSON.stringify(result)).not.toContain('web-cookie-token');
  });

  it('registers a new family with a mobile session', async () => {
    const user = { userId: 'parent-1', email: 'parent@example.com' };
    const mobile = {
      user,
      accessToken: 'access',
      refreshToken: 'refresh',
      accessExpiresAt: '2026-10-24T08:15:00.000Z',
    };
    const auth = {
      register: vi.fn().mockResolvedValue({ user, token: 'web-cookie-token' }),
      issueMobileSession: vi.fn().mockResolvedValue(mobile),
    };
    const controller = new AuthController(
      auth as unknown as AuthService,
      {} as InvitationService,
    );
    const dto = {
      email: user.email,
      password: 'some-password',
      displayName: 'Мама',
      householdName: 'Родина',
    };

    const result = await controller.mobileRegister(dto);

    expect(auth.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mobile);
  });

  it('refreshes a mobile session without setting a web cookie', async () => {
    const mobile = { accessToken: 'next-access', refreshToken: 'next-refresh' };
    const auth = { refreshMobileSession: vi.fn().mockResolvedValue(mobile) };
    const controller = new AuthController(
      auth as unknown as AuthService,
      {} as InvitationService,
    );

    const result = await controller.mobileRefresh({
      refreshToken: 'current-refresh',
    });

    expect(auth.refreshMobileSession).toHaveBeenCalledWith('current-refresh');
    expect(result).toEqual(mobile);
  });

  it('revokes the mobile session even when its access token is already expired', async () => {
    const auth = { revokeMobileSession: vi.fn().mockResolvedValue(undefined) };
    const controller = new AuthController(
      auth as unknown as AuthService,
      {} as InvitationService,
    );

    const result = await controller.mobileLogout({
      refreshToken: 'current-refresh',
    });

    expect(auth.revokeMobileSession).toHaveBeenCalledWith('current-refresh');
    expect(result).toEqual({ ok: true });
  });

  it('creates a mobile session after registering through a family invitation', async () => {
    const user = { userId: 'new-parent', email: 'invited@example.com' };
    const invitations = {
      register: vi.fn().mockResolvedValue({ user, token: 'web-cookie-token' }),
    };
    const mobile = { user, accessToken: 'access', refreshToken: 'refresh' };
    const auth = { issueMobileSession: vi.fn().mockResolvedValue(mobile) };
    const controller = new AuthController(
      auth as unknown as AuthService,
      invitations as unknown as InvitationService,
    );
    const dto = { displayName: 'Тато', password: 'some-password' };

    const result = await controller.mobileRegisterInvited(
      'invitation-token',
      dto,
    );

    expect(invitations.register).toHaveBeenCalledWith('invitation-token', dto);
    expect(auth.issueMobileSession).toHaveBeenCalledWith(user);
    expect(result).toEqual(mobile);
  });

  it('accepts an invitation with an existing mobile session and returns the new household', async () => {
    const current = {
      userId: 'parent-1',
      email: 'parent@example.com',
    } as AuthUser;
    const next = { ...current, householdId: 'household-2' };
    const invitations = {
      accept: vi
        .fn()
        .mockResolvedValue({ user: next, token: 'web-cookie-token' }),
    };
    const controller = new AuthController(
      {} as AuthService,
      invitations as unknown as InvitationService,
    );

    const result = await controller.mobileAcceptInvitation(
      current,
      'invitation-token',
    );

    expect(invitations.accept).toHaveBeenCalledWith(
      current,
      'invitation-token',
    );
    expect(result).toEqual({ user: next });
  });

  it('clears the access_token cookie when /auth/me detects a stale session', async () => {
    const current = {
      userId: 'parent-1',
      email: 'parent@example.com',
      householdId: 'deleted-household',
    } as AuthUser;
    const auth = {
      me: vi.fn().mockRejectedValue(new Error('Session expired')),
      upgradeWebToken: vi.fn(),
    };
    const clearCookie = vi.fn();
    const controller = new AuthController(
      auth as unknown as AuthService,
      {} as InvitationService,
    );

    await expect(
      controller.me(
        current,
        { cookies: { access_token: 'stale-cookie' } } as never,
        { clearCookie } as never,
      ),
    ).rejects.toThrow('Session expired');
    expect(clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
    expect(auth.upgradeWebToken).not.toHaveBeenCalled();
  });
});
