export const API_CACHE = {
  defaultTtlMs: 20_000,
  familyTtlMs: 5 * 60_000,
  dictionaryTtlMs: 60 * 60_000,
  maxEntries: 30,
  excludedPathFragments: [
    '/auth/me',
    '/health',
    '/sleep-reminders/',
    '/children/sleep/widget',
    '/children/sleep/status',
  ],
  dictionaryPathFragment: '/feeding/dictionary',
  familyPathFragment: '/auth/family',
  invalidationRules: [
    { match: '/shopping/', prefixes: ['/shopping/', '/home'] },
    { match: '/events', prefixes: ['/events', '/home'] },
    { match: '/children/tasks', prefixes: ['/children/tasks', '/home'] },
    { match: '/children/sleep', prefixes: ['/children/sleep', '/home'] },
    { match: '/children/measurements', prefixes: ['/children/measurements'] },
    { match: '/feeding/', prefixes: ['/feeding/records', '/home'] },
    { match: '/contacts', prefixes: ['/contacts'] },
  ],
} as const;
