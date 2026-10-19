function fillDatabaseEnv() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || '';
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL =
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      '';
  }
}

module.exports = { fillDatabaseEnv };

if (require.main === module) {
  fillDatabaseEnv();
}
