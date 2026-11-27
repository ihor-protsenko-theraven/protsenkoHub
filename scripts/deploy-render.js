const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function readHookFromEnvLocal() {
  const envLocalPath = path.join(rootDir, '.env.local');
  if (!fs.existsSync(envLocalPath)) return '';
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^RENDER_DEPLOY_HOOK_URL\s*=\s*(.*)$/);
    if (match) {
      return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

async function main() {
  const hookUrl =
    process.env.RENDER_DEPLOY_HOOK_URL?.trim() || readHookFromEnvLocal();

  if (!hookUrl) {
    console.error(
      'Не задано RENDER_DEPLOY_HOOK_URL.\n' +
        'Скопіюйте Deploy Hook у Render Dashboard (Service -> Settings -> Deploy Hook)\n' +
        'та додайте в .env.local рядок:\n' +
        '  RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-...\n' +
        'або передайте через змінну середовища перед запуском npm run deploy:render.',
    );
    process.exit(1);
  }

  let endpoint;
  try {
    endpoint = new URL(hookUrl);
  } catch {
    console.error('RENDER_DEPLOY_HOOK_URL має некоректний формат URL.');
    process.exit(1);
  }

  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== 'api.render.com' ||
    !endpoint.pathname.startsWith('/deploy/')
  ) {
    console.error(
      'RENDER_DEPLOY_HOOK_URL має бути офіційним HTTPS-посиланням https://api.render.com/deploy/...',
    );
    process.exit(1);
  }

  if (process.argv.includes('--clear-cache')) {
    endpoint.searchParams.set('clearCache', 'clear');
  }

  const response = await fetch(endpoint, { method: 'POST' });
  const text = await response.text();
  if (!response.ok) {
    console.error(
      `Render повернув помилку ${response.status}: ${text.slice(0, 300)}`,
    );
    process.exit(1);
  }

  let deployId = '';
  try {
    const parsed = JSON.parse(text);
    if (parsed?.deploy?.id) deployId = ` (deployId: ${parsed.deploy.id})`;
  } catch {
    // Plain-text response is valid.
  }

  console.log(`Деплой на Render запущено${deployId}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
