import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

function createMemoryKv(initial = null) {
  let stored = initial ? JSON.stringify(initial) : null;
  return {
    async get(_key, type) {
      if (stored === null) return null;
      return type === 'json' ? JSON.parse(stored) : stored;
    },
    async put(_key, value) {
      stored = value;
    },
    snapshot() {
      return stored ? JSON.parse(stored) : null;
    },
  };
}

test('scheduled worker calls the protected API endpoint without KV', async () => {
  const previous = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return { ok: true, status: 200, async json() { return { sent: 0, nextReminderAt: null }; } };
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

test('scheduled worker skips API call when nextReminderAt is still in the future', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, status: 200, async json() { return { sent: 0, nextReminderAt: null }; } };
  };
  const kv = createMemoryKv({
    nextReminderAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    checkedAt: Date.now(),
    dirty: false,
  });
  try {
    await worker.scheduled({}, {
      APP_ORIGIN: 'https://family.example',
      CRON_SECRET: 'test-secret',
      REMINDER_SCHEDULE: kv,
    });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test('scheduled worker wakes API when nextReminderAt is due and stores updated schedule', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  const next = new Date(Date.now() + 10 * 60_000).toISOString();
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, status: 200, async json() { return { sent: 1, nextReminderAt: next }; } };
  };
  const kv = createMemoryKv({
    nextReminderAt: new Date(Date.now() + 15_000).toISOString(),
    checkedAt: Date.now() - 10 * 60_000,
    dirty: false,
  });
  try {
    await worker.scheduled({}, {
      APP_ORIGIN: 'https://family.example',
      CRON_SECRET: 'test-secret',
      REMINDER_SCHEDULE: kv,
    });
    assert.equal(calls, 1);
    assert.equal(kv.snapshot().nextReminderAt, next);
    assert.equal(kv.snapshot().dirty, false);
  } finally {
    globalThis.fetch = previous;
  }
});
