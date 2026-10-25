import { InjectionToken } from '@angular/core';

declare const MOBILE_API_ORIGIN: string;

export const MOBILE_API_ORIGIN_TOKEN = new InjectionToken<string>('MOBILE_API_ORIGIN', {
  providedIn: 'root',
  factory: () => typeof MOBILE_API_ORIGIN === 'undefined' ? '' : MOBILE_API_ORIGIN,
});

export function mobileApiUrl(path: string, configuredOrigin: string): string {
  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
  } catch {
    throw new Error('Для мобільної збірки потрібна публічна HTTPS-адреса API.');
  }
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error('Адреса мобільного API має бути коренем HTTPS-домену без шляху чи параметрів.');
  }
  if (!path.startsWith('/api/v1/')) {
    throw new Error('Мобільний запит має належати до /api/v1/.');
  }
  return `${origin.origin}${path}`;
}
