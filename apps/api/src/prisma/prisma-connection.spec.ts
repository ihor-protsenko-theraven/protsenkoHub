import { neonRuntimeUrl, usesNeonDriver } from './prisma-connection';

describe('Neon runtime connection', () => {
  it('points a direct Neon host at the pooler and drops Prisma pool flags', () => {
    const runtime = neonRuntimeUrl(
      'postgresql://user:secret@ep-name.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=5&connect_timeout=5',
    );
    const parsed = new URL(runtime);

    expect(parsed.hostname).toBe('ep-name-pooler.eu-central-1.aws.neon.tech');
    expect(parsed.username).toBe('user');
    expect(parsed.password).toBe('secret');
    expect(parsed.pathname).toBe('/neondb');
    expect(parsed.searchParams.get('sslmode')).toBe('require');
    expect(parsed.searchParams.has('pgbouncer')).toBe(false);
    expect(parsed.searchParams.has('connection_limit')).toBe(false);
    expect(parsed.searchParams.has('connect_timeout')).toBe(false);
  });

  it('does not add a second pooler suffix', () => {
    const runtime = neonRuntimeUrl(
      'postgresql://user:secret@ep-name-pooler.eu-central-1.aws.neon.tech/neondb',
    );

    expect(new URL(runtime).hostname).toBe(
      'ep-name-pooler.eu-central-1.aws.neon.tech',
    );
  });

  it('leaves a local Postgres url on the standard driver', () => {
    const local = 'postgresql://user:secret@localhost:5432/hub';

    expect(usesNeonDriver(local)).toBe(false);
    expect(neonRuntimeUrl(local)).toBe(local);
  });
});
