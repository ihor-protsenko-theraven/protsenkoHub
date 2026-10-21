import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../configs/api.config';
import { ToastService } from './toast.service';

export const EXPECTED_GUEST_SESSION = new HttpContextToken<boolean>(() => false);

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const toasts = inject(ToastService);
  return next(request).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && request.url.startsWith(API_BASE_URL)) {
      const expectedGuest = request.context.get(EXPECTED_GUEST_SESSION) && error.status === 401;
      if (!expectedGuest) toasts.error(apiErrorMessage(error));
    }
    return throwError(() => error);
  }));
};

function apiErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Немає зв’язку із сервером. Перевірте інтернет і спробуйте ще раз.';
  if (error.status >= 500) return 'Сервер тимчасово недоступний. Спробуйте ще раз пізніше.';
  if (error.status === 401) return 'Потрібно увійти або перевірити дані входу.';
  const detail = error.error?.message;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.every((item) => typeof item === 'string')) return detail.join(' ');
  return `Не вдалося виконати запит. Код помилки: ${error.status}.`;
}
