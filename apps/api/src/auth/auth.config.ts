export const AUTH = {
  cookieName: 'access_token',
  cookiePath: '/',
  sameSite: 'lax' as const,
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  mobileAccessTtlSeconds: 15 * 60,
  mobileRefreshTtlMs: 30 * 24 * 60 * 60 * 1000,
  mobileRefreshBytes: 32,
  widgetRoutes: {
    snapshot: '/api/v1/children/sleep/widget',
    action: '/api/v1/children/sleep/widget/action',
  },
} as const;
