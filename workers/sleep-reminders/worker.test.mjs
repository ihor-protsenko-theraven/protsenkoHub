import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

test('scheduled worker calls the protected API endpoint', async () => {
  const previous = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return { ok: true, status: 200 };
  };
  try {
    await worker.scheduled({}, {
      APP_ORIGIN: 'https://family.example',
      CRON_SECRET: 'test-secret',
    });
    assert.equal(request.url, 'https://family.example/api/v1/sleep-reminders/dispatch');
    assert.equal(request.options.headers.Authorization, 'Bearer test-secret');
  } finally {
    globalThis.fetch = previous;
  }
});
