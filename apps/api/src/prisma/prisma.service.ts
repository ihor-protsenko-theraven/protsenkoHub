import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { neonRuntimeUrl, usesNeonDriver } from './prisma-connection';

const DEFAULT_NEON_POOL_MAX = 3;
const NEON_IDLE_MS = 10_000;
const NEON_CONNECT_TIMEOUT_MS = 20_000;

function neonPoolMax(): number {
  const parsed = Number(process.env.DB_POOL_MAX);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 10) {
    return parsed;
  }
  return DEFAULT_NEON_POOL_MAX;
}

function neonClientOptions(): ConstructorParameters<typeof PrismaClient>[0] {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !usesNeonDriver(databaseUrl)) return {};
  return {
    adapter: new PrismaNeon({
      connectionString: neonRuntimeUrl(databaseUrl),
      max: neonPoolMax(),
      idleTimeoutMillis: NEON_IDLE_MS,
      connectionTimeoutMillis: NEON_CONNECT_TIMEOUT_MS,
    }),
  };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly neonDriver = usesNeonDriver(process.env.DATABASE_URL ?? '');

  constructor() {
    super(neonClientOptions());
  }

  async onModuleInit(): Promise<void> {
    if (this.neonDriver) return;
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
