import { InjectionToken } from '@angular/core';

declare const MOBILE_WEB_ORIGIN: string;

export const MOBILE_WEB_ORIGIN_TOKEN = new InjectionToken<string>('MOBILE_WEB_ORIGIN', {
  providedIn: 'root',
  factory: () => typeof MOBILE_WEB_ORIGIN === 'undefined' ? '' : MOBILE_WEB_ORIGIN,
});
