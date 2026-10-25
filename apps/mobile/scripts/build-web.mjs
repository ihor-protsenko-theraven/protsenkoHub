import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = resolve(mobileRoot, '..', 'web');
function requireHttpsOrigin(name) {
  let url;
  try {
    url = new URL(process.env[name]);
  } catch {
    console.error(`${name} must be set to a public root HTTPS origin before building the mobile app.`);
    process.exit(1);
  }
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    console.error(`${name} must be a root HTTPS origin without a path, query, hash, or credentials.`);
    process.exit(1);
  }
  return url.origin;
}

const apiOrigin = requireHttpsOrigin('MOBILE_API_ORIGIN');
const webOrigin = requireHttpsOrigin('MOBILE_WEB_ORIGIN');

const angularCli = resolve(webRoot, '..', '..', 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const result = spawnSync(process.execPath, [
  angularCli,
  'build',
  '--configuration=production,mobile',
  `--define=MOBILE_API_ORIGIN=${JSON.stringify(apiOrigin)}`,
  `--define=MOBILE_WEB_ORIGIN=${JSON.stringify(webOrigin)}`,
], { cwd: webRoot, stdio: 'inherit' });

process.exit(result.status ?? 1);
