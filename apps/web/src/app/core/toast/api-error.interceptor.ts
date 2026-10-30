import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../configs/api.config';
import { isNativeApp } from '../configs/native-platform.config';
import { AuthService } from '../services/auth.service';
import { TOAST_CONFIG } from './toast.config';
import { ToastService } from './toast.service';

export const EXPECTED_GUEST_SESSION = new HttpContextToken<boolean>(() => false);

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const toasts = inject(ToastService);
  const injector = inject(Injector);
  return next(request).pipe(tap((event) => {
    if (request.url.startsWith(API_BASE_URL) && event instanceof HttpResponse) toasts.dismissConnectivityError();
  }), catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && request.url.startsWith(API_BASE_URL)) {
      if (error.status !== 0) toasts.dismissConnectivityError();
      const expectedGuest = request.context.get(EXPECTED_GUEST_SESSION) && error.status === 401;
      if (!expectedGuest) {
        toasts.error(apiErrorMessage(error));
        if (
          error.status === 401 &&
          !isNativeApp() &&
          !request.url.endsWith('/auth/login') &&
          !request.url.endsWith('/auth/register')
        ) {
          const auth = injector.get(AuthService, null);
          auth?.user.set(null);
          const router = injector.get(Router, null);
          void router?.navigateByUrl('/login');
        }
      }
    }
    return throwError(() => error);
  }));
};

function apiErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) return TOAST_CONFIG.connectivityErrorMessage;
  if (error.status >= 500) return 'Сервер тимчасово недоступний. Спробуйте ще раз пізніше.';
  if (error.status === 401) return 'Потрібно увійти або перевірити дані входу.';
  const detail = error.error?.message;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.every((item) => typeof item === 'string')) return detail.join(' ');
  return `Не вдалося виконати запит. Код помилки: ${error.status}.`;
}
