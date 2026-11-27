const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { fillDatabaseEnv } = require('./database-env');

const rootDir = path.resolve(__dirname, '..');
const MAX_MIGRATE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrations() {
  for (let attempt = 1; attempt <= MAX_MIGRATE_ATTEMPTS; attempt += 1) {
    const result = spawnSync('npm exec -w api -- prisma migrate deploy', {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });
    if (result.status === 0) return;
    if (attempt < MAX_MIGRATE_ATTEMPTS) {
      console.warn(
        `prisma migrate deploy не вдався (спроба ${attempt}/${MAX_MIGRATE_ATTEMPTS}), повтор через ${RETRY_DELAY_MS / 1000} с...`,
      );
      await sleep(RETRY_DELAY_MS);
    } else {
      process.exit(result.status ?? 1);
    }
  }
}

async function main() {
  fillDatabaseEnv();
  if (process.env.RUN_MIGRATIONS !== 'false') {
    await runMigrations();
  }
  require(path.join(rootDir, 'apps', 'api', 'dist', 'main.js'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
