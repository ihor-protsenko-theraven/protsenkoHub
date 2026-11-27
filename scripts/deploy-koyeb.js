const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function readEnvLocal(key) {
  const envLocalPath = path.join(rootDir, '.env.local');
  if (!fs.existsSync(envLocalPath)) return '';
  const content = fs.readFileSync(envLocalPath, 'utf8');
  const pattern = new RegExp(`^${key}\\s*=\\s*(.*)$`);
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(pattern);
    if (match) {
      return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

async function main() {
  const token =
    process.env.KOYEB_API_TOKEN?.trim() || readEnvLocal('KOYEB_API_TOKEN');
  const serviceId =
    process.env.KOYEB_SERVICE_ID?.trim() || readEnvLocal('KOYEB_SERVICE_ID');

  if (!token || !serviceId) {
    console.error(
      'Не задано KOYEB_API_TOKEN або KOYEB_SERVICE_ID.\n' +
        '1. Створіть сервіс у Koyeb Dashboard (GitHub -> Dockerfile, порт 3001, healthcheck /api/v1/health).\n' +
        '2. Згенеруйте API token у Koyeb (Organization Settings -> API) та скопіюйте Service ID.\n' +
        '3. Додайте в .env.local:\n' +
        '   KOYEB_API_TOKEN=...\n' +
        '   KOYEB_SERVICE_ID=...\n' +
        'після чого запустіть npm run deploy:koyeb.',
    );
    process.exit(1);
  }

  const useCache = !process.argv.includes('--clear-cache');
  const endpoint = `https://app.koyeb.com/v1/services/${encodeURIComponent(serviceId)}/redeploy`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ use_cache: useCache }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(
      `Koyeb повернув помилку ${response.status}: ${text.slice(0, 300)}`,
    );
    process.exit(1);
  }

  let deploymentId = '';
  try {
    const parsed = JSON.parse(text);
    if (parsed?.deployment?.id) {
      deploymentId = ` (deploymentId: ${parsed.deployment.id})`;
    }
  } catch {
    // Non-JSON response is acceptable.
  }

  console.log(`Деплой на Koyeb запущено${deploymentId}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
