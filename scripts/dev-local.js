const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const DB_HOST = '127.0.0.1';
const DB_PORT = 5432;
const DB_WAIT_TIMEOUT_MS = 30_000;
const DB_WAIT_INTERVAL_MS = 500;

function runStep(command, errorHint) {
  const result = spawnSync(command, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    if (errorHint) console.error(`\n${errorHint}`);
    process.exit(result.status ?? 1);
  }
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function waitForPostgres() {
  const deadline = Date.now() + DB_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await canConnect(DB_HOST, DB_PORT)) return;
    await new Promise((resolve) => setTimeout(resolve, DB_WAIT_INTERVAL_MS));
  }
  console.error(
    `\nPostgreSQL не відповідає на ${DB_HOST}:${DB_PORT} після ${DB_WAIT_TIMEOUT_MS / 1000} с.`,
  );
  process.exit(1);
}

function startChild(label, command) {
  const child = spawn(command, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`\n[${label}] завершився з кодом ${code}`);
    }
  });
  return child;
}

async function main() {
  runStep('node ./scripts/ensure-env.js');
  runStep(
    'docker compose up -d',
    'Не вдалося запустити локальний PostgreSQL. Перевірте, що Docker Desktop запущений.',
  );

  console.log(`Очікую готовність PostgreSQL на ${DB_HOST}:${DB_PORT}...`);
  await waitForPostgres();

  runStep('npm exec -w api -- prisma migrate deploy');

  console.log('\nЗапускаю API (:3001) та Web (:4200)...');
  const api = startChild('api', 'npm run dev:api');
  const web = startChild('web', 'npm run dev:web');
  const children = [api, web];

  let shuttingDown = false;
  const shutdown = (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) child.kill('SIGTERM');
    }
    process.exit(exitCode);
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  api.on('exit', (code) => shutdown(code ?? 0));
  web.on('exit', (code) => shutdown(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
