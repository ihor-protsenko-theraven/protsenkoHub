import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { neonRuntimeUrl, usesNeonDriver } from './prisma-connection';

const NEON_POOL_MAX = 1;
const NEON_IDLE_MS = 5_000;
const NEON_CONNECT_TIMEOUT_MS = 20_000;

function neonClientOptions(): ConstructorParameters<typeof PrismaClient>[0] {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !usesNeonDriver(databaseUrl)) return {};
  return {
    adapter: new PrismaNeon({
      connectionString: neonRuntimeUrl(databaseUrl),
      max: NEON_POOL_MAX,
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
