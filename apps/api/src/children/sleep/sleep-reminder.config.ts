export const SLEEP_REMINDER = {
  leadMinutes: [20, 10, 0] as const,
  minuteMs: 60_000,
  sendWindowMs: 90_000,
  pushTtlSeconds: 30 * 60,
  urgency: 'high' as const,
  pushTimeoutMs: 10_000,
  maxEndpointLength: 2048,
  maxKeyLength: 256,
  publicPath: '/app/sleep',
} as const;
