export const HOUSEHOLD_PUSH = {
  pushTtlSeconds: 30 * 60,
  urgency: 'high' as const,
  pushTimeoutMs: 10_000,
  icon: '/icons/icon-192.png',
  clickOperation: 'navigateLastFocusedOrOpen' as const,
  paths: {
    sleep: '/app/sleep',
    children: '/app/children',
  },
  titles: {
    sleepStarted: 'Сон почався',
    sleepStopped: 'Сон закінчився',
    taskCompleted: 'Задачу завершено',
  },
  tagPrefixes: {
    sleepStarted: 'sleep-start',
    sleepStopped: 'sleep-stop',
    taskCompleted: 'task-done',
  },
} as const;
