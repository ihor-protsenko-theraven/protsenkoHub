import { ApplicationConfig, ErrorHandler, isDevMode, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeUk from '@angular/common/locales/uk';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { apiErrorInterceptor } from './core/toast/api-error.interceptor';
import { AppErrorHandler } from './core/toast/app-error.handler';
import { ToastService } from './core/toast/toast.service';
import { isNativeApp } from './core/configs/native-platform.config';
import { nativeApiInterceptor } from './core/services/native-api.interceptor';

registerLocaleData(localeUk);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'uk' },
    ToastService,
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([apiErrorInterceptor, nativeApiInterceptor])),
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() && !isNativeApp() }),
  ],
};
