export default {
  async scheduled(_event, env) {
    if (!env.APP_ORIGIN || !env.CRON_SECRET) {
      throw new Error('APP_ORIGIN and CRON_SECRET are required');
    }
    const origin = new URL(env.APP_ORIGIN);
    if (origin.protocol !== 'https:') {
      throw new Error('APP_ORIGIN must use HTTPS');
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
  },
};
