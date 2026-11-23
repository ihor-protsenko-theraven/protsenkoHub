const { spawnSync } = require('child_process');
const { fillDatabaseEnv } = require('./database-env');

fillDatabaseEnv();

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/with-database-env.js <command> [args]');
  process.exit(1);
}
if (process.env.SKIP_PRISMA_GENERATE === '1' && args.includes('db:generate')) {
  process.exit(0);
}

const command = args.join(' ');
const result = spawnSync(command, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
