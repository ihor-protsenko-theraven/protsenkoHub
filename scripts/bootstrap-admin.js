const { createRequire } = require('module');
const path = require('path');
const requireFromApi = createRequire(path.join(__dirname, '../apps/api/package.json'));
const { PrismaClient } = requireFromApi('@prisma/client');
const bcrypt = requireFromApi('bcrypt');
const { fillDatabaseEnv } = require('./database-env');

async function main() {
  fillDatabaseEnv();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('ADMIN_EMAIL or ADMIN_PASSWORD is unset. Skipping admin bootstrap.');
    return;
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });
    if (existing?.memberships.length) {
      console.log('Admin already exists.');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = process.env.ADMIN_NAME?.trim() || 'Адмін';
    const householdName = process.env.HOUSEHOLD_NAME?.trim() || 'Родина';

    await prisma.$transaction(async (tx) => {
      const user =
        existing ??
        (await tx.user.create({
          data: { email, passwordHash, displayName },
        }));
      const household = await tx.household.create({
        data: { name: householdName, timezone: 'Europe/Kyiv' },
      });
      await tx.membership.create({
        data: {
          userId: user.id,
          householdId: household.id,
          role: 'ADMIN',
          displayName,
        },
      });
    });
    console.log('Admin household created.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
