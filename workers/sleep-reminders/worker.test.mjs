import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { SleepReminderAlarm } from './worker.mjs';

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

test('missing KV stops cron before contacting the API', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch');
  await assert.rejects(
    worker.scheduled({}, {
      APP_ORIGIN: 'https://family.example',
      CRON_SECRET: 'test-secret',
    }),
    /REMINDER_SCHEDULE is required/,
  );
  assert.equal(fetch.mock.callCount(), 0);
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

test('a 24-hour API outage backs off to hourly probes', async (t) => {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  const env = {
    APP_ORIGIN: 'https://family.example',
    CRON_SECRET: 'test-secret',
    REMINDER_SCHEDULE: createMemoryKv(),
  };
  for (let minute = 0; minute < 1_440; minute++) {
    now = minute * 60_000;
    await worker.scheduled({}, env).catch((error) => {
      assert.match(error.message, /503/);
    });
  }
  assert.equal(fetch.mock.callCount(), 28);
  assert.equal(fetch.mock.calls[0].arguments[1].headers.Authorization, 'Bearer test-secret');
  assert.ok(fetch.mock.calls[0].arguments[1].signal instanceof AbortSignal);
});

test('alarm dispatches at the next deadline and stops once there is no reminder', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  let stored;
  let alarmAt;
  const storage = {
    async get() { return stored; },
    async put(_key, value) { stored = value; },
    async setAlarm(when) { alarmAt = when; },
    async deleteAlarm() { alarmAt = null; },
  };
  const due = now + 10 * 60_000;
  let nextReminderAt = new Date(due).toISOString();
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ nextReminderAt }));
  const env = { APP_ORIGIN: 'https://family.example', CRON_SECRET: 'test-secret', REMINDER_MODE: 'alarm' };
  const object = new SleepReminderAlarm({ storage, blockConcurrencyWhile: (run) => run() }, env);
  const initialize = () => object.fetch(new Request('https://reminder.internal/initialize', { method: 'POST' }));

  await initialize();
  now = alarmAt;
  await object.alarm();
  assert.equal(alarmAt, due - 60_000);
  now = alarmAt;
  await object.alarm();
  assert.equal(alarmAt, due);
  now = alarmAt;
  nextReminderAt = null;
  await object.alarm();
  await initialize();
  assert.equal(alarmAt, null);
  assert.equal(fetch.mock.callCount(), 3);
});
