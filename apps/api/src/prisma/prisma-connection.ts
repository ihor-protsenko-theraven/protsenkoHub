const PRISMA_ONLY_PARAMS = [
  'pgbouncer',
  'connection_limit',
  'pool_timeout',
  'connect_timeout',
  'socket_timeout',
  'statement_cache_size',
] as const;

export function usesNeonDriver(databaseUrl: string): boolean {
  try {
    return new URL(databaseUrl).hostname.endsWith('.neon.tech');
  } catch {
    return false;
  }
}

/** Pooled Neon host, without Prisma engine flags the serverless driver would forward. */
export function neonRuntimeUrl(databaseUrl: string): string {
  if (!usesNeonDriver(databaseUrl)) return databaseUrl;
  const url = new URL(databaseUrl);
  const [endpoint, ...rest] = url.hostname.split('.');
  if (endpoint && !endpoint.endsWith('-pooler')) {
    url.hostname = [`${endpoint}-pooler`, ...rest].join('.');
  }
  for (const key of PRISMA_ONLY_PARAMS) url.searchParams.delete(key);
  return url.toString();
}
