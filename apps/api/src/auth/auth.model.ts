import type { AuthUser } from '../common/types';

export interface JwtPayload {
  sub: string;
  email: string;
  typ?: 'mobile-access' | 'widget-action';
  sid?: string;
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
