import type { SleepOverview } from './sleep.model';

export function normalizeSleepOverview(overview: SleepOverview): SleepOverview {
  return {
    ...overview,
    active: overview.active ? { ...overview.active, pauses: overview.active.pauses ?? [] } : null,
    sessions: overview.sessions.map((session) => ({ ...session, pauses: session.pauses ?? [] })),
  };
}
