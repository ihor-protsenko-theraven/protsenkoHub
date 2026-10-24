const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, 'scripts', 'database-env.js'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Cannot find repository root from ${start}`);
}

function runStatus(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });
  return result.status ?? 1;
}

function run(command, cwd) {
  const status = runStatus(command, cwd);
  if (status !== 0) process.exit(status);
}

function stripBom(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    fs.writeFileSync(file, bytes.subarray(3));
  }
}

function stripMigrationBoms(rootDir) {
  const migrations = path.join(rootDir, 'apps', 'api', 'prisma', 'migrations');
  if (!fs.existsSync(migrations)) return;
  for (const entry of fs.readdirSync(migrations, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sql = path.join(migrations, entry.name, 'migration.sql');
    if (fs.existsSync(sql)) stripBom(sql);
  }
}

const root = findRoot(__dirname);
run('npm ci', root);
require(path.join(root, 'scripts', 'database-env.js')).fillDatabaseEnv();
stripMigrationBoms(root);

const migrate = 'npm exec -w api -- prisma migrate deploy';
run(migrate, root);

run('node ./scripts/bootstrap-admin.js', root);
