export const AUTH = {
  cookieName: 'access_token',
  cookiePath: '/',
  sameSite: 'lax' as const,
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
} as const;
