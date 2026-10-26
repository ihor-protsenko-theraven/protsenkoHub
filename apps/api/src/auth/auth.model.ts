import type { MemberRole } from '@prisma/client';
import type { AuthUser } from '../common/types';

export interface JwtPayload {
  sub: string;
  email: string;
  typ?: 'mobile-access' | 'widget-action';
  sid?: string;
  householdId?: string;
  membershipId?: string;
  displayName?: string;
  role?: MemberRole;
  color?: string;
}

export function webAccessTokenPayload(user: AuthUser): JwtPayload {
  return {
    sub: user.userId,
    email: user.email,
    householdId: user.householdId,
    membershipId: user.membershipId,
    displayName: user.displayName,
    role: user.role,
    color: user.color,
  };
}

export function authUserFromWebPayload(payload: JwtPayload): AuthUser | null {
  if (
    payload.typ !== undefined ||
    !payload.householdId ||
    !payload.membershipId ||
    !payload.displayName ||
    !payload.color ||
    (payload.role !== 'ADMIN' && payload.role !== 'MEMBER')
  ) {
    return null;
  }
  return {
    userId: payload.sub,
    email: payload.email,
    displayName: payload.displayName,
    householdId: payload.householdId,
    membershipId: payload.membershipId,
    role: payload.role,
    color: payload.color,
  };
}

export interface MobileSessionResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  actionCredential: {
    token: string;
    expiresAt: string;
  };
}
