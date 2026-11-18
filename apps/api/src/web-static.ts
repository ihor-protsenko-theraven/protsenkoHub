import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import express, { type Express } from 'express';

export function serveWeb(app: Express, browserDirectory: string): void {
  const indexFile = join(browserDirectory, 'index.html');
  if (!existsSync(indexFile)) {
    throw new Error(`Angular build is missing: ${indexFile}`);
  }

  app.use(express.static(browserDirectory, { index: false }));
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

    response.sendFile(indexFile);
  });
}
