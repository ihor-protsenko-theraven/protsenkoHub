function fillDatabaseEnv() {
  if (!process.env.DATABASE_URL) {
    const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
    if (url) process.env.DATABASE_URL = url;
  }
  if (!process.env.DIRECT_URL) {
    const direct =
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL;
    if (direct) process.env.DIRECT_URL = direct;
  }
}

module.exports = { fillDatabaseEnv };

if (require.main === module) {
  fillDatabaseEnv();
}
