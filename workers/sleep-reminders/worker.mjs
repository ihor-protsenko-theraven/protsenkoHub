const SCHEDULE_KEY = 'sleep-reminder-schedule';
const EARLY_WAKE_MS = 60_000;
const IDLE_RECHECK_MS = 60 * 60_000;
const REQUEST_TIMEOUT_MS = 75_000;
const MAX_RETRY_MS = 60 * 60_000;

function failureState(schedule, nowMs) {
  const failures = Math.min((schedule?.failures ?? 0) + 1, 7);
  return { ...schedule, failures, retryAt: nowMs + Math.min(60_000 * 2 ** (failures - 1), MAX_RETRY_MS) };
}

function shouldDispatch(schedule, nowMs) {
  if (schedule?.retryAt > nowMs) return false;
  if (!schedule || schedule.dirty) return true;
  if (typeof schedule.nextReminderAt === 'string') {
    const dueMs = Date.parse(schedule.nextReminderAt);
    if (!Number.isFinite(dueMs)) return true;
    return nowMs >= dueMs - EARLY_WAKE_MS;
  }
  const checkedAt = typeof schedule.checkedAt === 'number' ? schedule.checkedAt : 0;
  return nowMs - checkedAt >= IDLE_RECHECK_MS;
}

async function dispatch(env) {
  if (!env.APP_ORIGIN || !env.CRON_SECRET) {
    throw new Error('APP_ORIGIN and CRON_SECRET are required');
  }
  const origin = new URL(env.APP_ORIGIN);
  if (origin.protocol !== 'https:') {
    throw new Error('APP_ORIGIN must use HTTPS');
  }
  const response = await fetch(new URL('/api/v1/sleep-reminders/dispatch', origin), {
    method: 'GET',
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Sleep reminder dispatch returned ${response.status}`);
  }
  const body = await response.json();
  if (body?.nextReminderAt !== null &&
      (typeof body?.nextReminderAt !== 'string' || !Number.isFinite(Date.parse(body.nextReminderAt)))) {
    throw new Error('Invalid sleep reminder schedule returned by API');
  }
  return body.nextReminderAt;
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
    if (env.REMINDER_MODE === 'alarm') {
      await notifyAlarm(env, 'initialize');
      return;
    }
    const nowMs = Date.now();
    const kv = env.REMINDER_SCHEDULE;
    if (!kv) throw new Error('REMINDER_SCHEDULE is required in cron mode');
    const current = await kv.get(SCHEDULE_KEY, 'json');
    if (!shouldDispatch(current, nowMs)) return;
    let nextReminderAt;
    try {
      nextReminderAt = await dispatch(env);
    } catch (error) {
      await kv.put(SCHEDULE_KEY, JSON.stringify(failureState(current, Date.now())));
      throw error;
    }
    await kv.put(SCHEDULE_KEY, JSON.stringify({ nextReminderAt, checkedAt: Date.now(), dirty: false }));
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
    if (env.REMINDER_MODE === 'alarm') {
      await notifyAlarm(env, 'reschedule');
      return Response.json({ ok: true });
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
    } else {
      return new Response('REMINDER_SCHEDULE is unavailable', { status: 503 });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function notifyAlarm(env, action) {
  const alarm = env.REMINDER_ALARM.getByName(SCHEDULE_KEY);
  const response = await alarm.fetch(`https://reminder.internal/${action}`, { method: 'POST' });
  if (!response.ok) throw new Error(`Could not ${action} sleep reminder alarm`);
}

export class SleepReminderAlarm {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const action = new URL(request.url).pathname;
    if (request.method !== 'POST' || !['/initialize', '/reschedule'].includes(action)) {
      return new Response(null, { status: 404 });
    }
    await this.state.blockConcurrencyWhile(async () => {
      const current = await this.state.storage.get(SCHEDULE_KEY);
      if (action === '/initialize' && current) return;
      const next = { ...current, generation: (current?.generation ?? 0) + 1 };
      await this.state.storage.setAlarm(Math.max(Date.now() + 1_000, next.retryAt ?? 0));
      await this.state.storage.put(SCHEDULE_KEY, next);
    });
    return new Response(null, { status: 204 });
  }

  async alarm() {
    if (this.env.REMINDER_MODE !== 'alarm') return;
    const schedule = await this.state.storage.get(SCHEDULE_KEY);
    if (!schedule) return;
    let nextReminderAt;
    let failure;
    try {
      nextReminderAt = await dispatch(this.env);
    } catch (error) {
      failure = error;
    }
    await this.state.blockConcurrencyWhile(async () => {
      const current = await this.state.storage.get(SCHEDULE_KEY);
      if (current?.generation !== schedule.generation) return;

      const now = Date.now();
      if (failure) {
        const next = failureState(schedule, now);
        await this.state.storage.setAlarm(next.retryAt);
        await this.state.storage.put(SCHEDULE_KEY, next);
        console.error(String(failure));
        return;
      }
      if (nextReminderAt) {
        const due = Date.parse(nextReminderAt);
        const early = due - EARLY_WAKE_MS;
        await this.state.storage.setAlarm(early > now ? early : Math.max(due, now + 1_000));
      } else {
        await this.state.storage.deleteAlarm();
      }
      await this.state.storage.put(SCHEDULE_KEY, { generation: schedule.generation });
    });
  }
}
