import type { AuthUser } from './auth.model';

export interface MobileAuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  actionCredential: {
    token: string;
    expiresAt: string;
  };
}
