import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../configs/api.config';
import { API_CACHE } from '../configs/api-cache.config';

interface CacheEntry {
  readonly expiresAt: number;
  readonly isStatic: boolean;
  readonly response: HttpResponse<unknown>;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Observable<HttpEvent<unknown>>>();

export function clearApiCache(includeStatic = false): void {
  inFlight.clear();
  if (includeStatic) {
    cache.clear();
    return;
  }
  for (const [key, entry] of cache.entries()) {
    if (!entry.isStatic) cache.delete(key);
  }
}

function invalidateForMutation(url: string): void {
  const rule = API_CACHE.invalidationRules.find((item) => url.includes(item.match));
  if (!rule) {
    clearApiCache();
    return;
  }
  for (const [key, entry] of cache.entries()) {
    if (entry.isStatic) continue;
    if (rule.prefixes.some((prefix) => key.includes(prefix))) {
      cache.delete(key);
    }
  }
  for (const key of inFlight.keys()) {
    if (rule.prefixes.some((prefix) => key.includes(prefix))) {
      inFlight.delete(key);
    }
  }
}

function isApiUrl(url: string): boolean {
  return url.startsWith(API_BASE_URL) || url.includes('/api/v1/');
}

function isExcluded(url: string): boolean {
  return API_CACHE.excludedPathFragments.some((fragment) => url.includes(fragment));
}

function ttlForUrl(url: string): { ttlMs: number; isStatic: boolean } {
  if (url.includes(API_CACHE.dictionaryPathFragment)) {
    return { ttlMs: API_CACHE.dictionaryTtlMs, isStatic: true };
  }
  if (url.includes(API_CACHE.familyPathFragment)) {
    return { ttlMs: API_CACHE.familyTtlMs, isStatic: false };
  }
  return { ttlMs: API_CACHE.defaultTtlMs, isStatic: false };
}

export const apiCacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url)) return next(req);

  if (req.method !== 'GET') {
    invalidateForMutation(req.urlWithParams);
    return next(req);
  }

  if (req.cache === 'no-store' || isExcluded(req.urlWithParams)) return next(req);

  const key = req.urlWithParams;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now < cached.expiresAt) {
    return of(cached.response.clone());
  }
  if (cached) cache.delete(key);

  const pending = inFlight.get(key);
  if (pending) {
    return pending.pipe(
      map((event) => (event instanceof HttpResponse ? event.clone() : event)),
    );
  }

  const { ttlMs, isStatic } = ttlForUrl(key);
  const request$ = next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.status === 200) {
        if (cache.size >= API_CACHE.maxEntries) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey !== undefined) cache.delete(oldestKey);
        }
        cache.set(key, {
          expiresAt: Date.now() + ttlMs,
          isStatic,
          response: event.clone(),
        });
      }
    }),
    finalize(() => inFlight.delete(key)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  inFlight.set(key, request$);
  return request$.pipe(
    map((event) => (event instanceof HttpResponse ? event.clone() : event)),
  );
};
