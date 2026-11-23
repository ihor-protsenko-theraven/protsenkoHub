const SCHEDULE_KEY = 'sleep-reminder-schedule';
const EARLY_WAKE_MS = 60_000;
const IDLE_RECHECK_MS = 60 * 60_000;

function shouldDispatch(schedule, nowMs) {
  if (!schedule || schedule.dirty) return true;
  if (typeof schedule.nextReminderAt === 'string') {
    const dueMs = Date.parse(schedule.nextReminderAt);
    if (!Number.isFinite(dueMs)) return true;
    return nowMs >= dueMs - EARLY_WAKE_MS;
  }
  const checkedAt = typeof schedule.checkedAt === 'number' ? schedule.checkedAt : 0;
  return nowMs - checkedAt >= IDLE_RECHECK_MS;
}

function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export default {
  async scheduled(_event, env) {
    if (!env.APP_ORIGIN || !env.CRON_SECRET) {
      throw new Error('APP_ORIGIN and CRON_SECRET are required');
    }
    const origin = new URL(env.APP_ORIGIN);
    if (origin.protocol !== 'https:') {
      throw new Error('APP_ORIGIN must use HTTPS');
    }

    const nowMs = Date.now();
    const kv = env.REMINDER_SCHEDULE;
    if (kv) {
      const current = await kv.get(SCHEDULE_KEY, 'json');
      if (!shouldDispatch(current, nowMs)) {
        return;
      }
    }

    const endpoint = new URL('/api/v1/sleep-reminders/dispatch', origin);
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Sleep reminder dispatch returned ${response.status}`);
    }

    if (kv) {
      let nextReminderAt = null;
      try {
        const body = await response.json();
        if (body && typeof body.nextReminderAt === 'string') {
          nextReminderAt = body.nextReminderAt;
        }
      } catch {
        nextReminderAt = null;
      }
      await kv.put(
        SCHEDULE_KEY,
        JSON.stringify({ nextReminderAt, checkedAt: nowMs, dirty: false }),
      );
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/schedule') {
      return new Response('Not Found', { status: 404 });
    }
    const secret = env.CRON_SECRET;
    const actual = request.headers.get('Authorization') ?? '';
    const expected = secret ? `Bearer ${secret}` : '';
    if (!secret || !constantTimeEquals(actual, expected)) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (env.REMINDER_SCHEDULE) {
      let nextReminderAt = null;
      let dirty = true;
      try {
        const body = await request.json();
        if (body && typeof body.nextReminderAt === 'string') {
          nextReminderAt = body.nextReminderAt;
          dirty = false;
        }
      } catch {
        dirty = true;
      }
      await env.REMINDER_SCHEDULE.put(
        SCHEDULE_KEY,
        JSON.stringify({ nextReminderAt, checkedAt: Date.now(), dirty }),
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
