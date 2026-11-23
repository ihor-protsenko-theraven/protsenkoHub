import { existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import express, { type Express } from 'express';

const HASHED_ASSET = /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|svg|webp)$/i;
const NO_CACHE_FILES = new Set([
  'index.html',
  'ngsw.json',
  'ngsw-worker.js',
  'safety-worker.js',
  'worker-basic.min.js',
  'manifest.webmanifest',
]);

export function serveWeb(app: Express, browserDirectory: string): void {
  const indexFile = join(browserDirectory, 'index.html');
  if (!existsSync(indexFile)) {
    throw new Error(`Angular build is missing: ${indexFile}`);
  }

  app.use(
    express.static(browserDirectory, {
      index: false,
      setHeaders: (response, filePath) => {
        const name = basename(filePath);
        if (NO_CACHE_FILES.has(name)) {
          response.setHeader('Cache-Control', 'no-cache');
        } else if (HASHED_ASSET.test(name)) {
          response.setHeader(
            'Cache-Control',
            'public, max-age=31536000, immutable',
          );
        } else {
          response.setHeader('Cache-Control', 'public, max-age=86400');
        }
      },
    }),
  );
  app.use((request, response, next) => {
    const isApiPath =
      request.path === '/api' || request.path.startsWith('/api/');
    const isPageRequest =
      (request.method === 'GET' || request.method === 'HEAD') &&
      !isApiPath &&
      !extname(request.path) &&
      request.accepts('html');

    if (!isPageRequest) {
      next();
      return;
    }

    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(indexFile);
  });
}
