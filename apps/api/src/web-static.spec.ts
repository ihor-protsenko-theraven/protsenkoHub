import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { serveWeb } from './web-static';

describe('serveWeb', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('serves assets and Angular routes without intercepting API routes', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'protsenko-web-'));
    directories.push(directory);
    mkdirSync(join(directory, 'assets'));
    writeFileSync(join(directory, 'index.html'), '<h1>Family hub</h1>');
    writeFileSync(join(directory, 'assets', 'icon.svg'), '<svg />');

    const app = express();
    serveWeb(app, directory);
    app.get('/api/v1/health', (_request, response) => {
      response.json({ ok: true });
    });

    expect((await request(app).get('/')).text).toContain('Family hub');
    expect((await request(app).get('/app/sleep')).text).toContain('Family hub');
    const iconBody: unknown = (await request(app).get('/assets/icon.svg')).body;
    expect(Buffer.isBuffer(iconBody)).toBe(true);
    if (!Buffer.isBuffer(iconBody)) {
      throw new Error('Icon response is not a buffer');
    }
    expect(iconBody.toString()).toBe('<svg />');

    const healthBody: unknown = (await request(app).get('/api/v1/health')).body;
    expect(healthBody).toEqual({ ok: true });
    expect((await request(app).get('/missing.js')).status).toBe(404);
  });

  it('fails startup when the Angular build is absent', () => {
    const app = express();
    expect(() =>
      serveWeb(app, join(tmpdir(), 'missing-protsenko-web')),
    ).toThrow('Angular build is missing');
  });
});
