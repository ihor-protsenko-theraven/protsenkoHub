import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, defer, from, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../configs/api.config';
import { MOBILE_API_ORIGIN_TOKEN, mobileApiUrl } from '../configs/mobile-api.config';
import { isNativeApp } from '../configs/native-platform.config';
import { AuthService } from './auth.service';

export const nativeApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isNativeApp() || !request.url.startsWith(`${API_BASE_URL}/`)) return next(request);

  const auth = inject(AuthService);
  const origin = inject(MOBILE_API_ORIGIN_TOKEN);
  const url = mobileApiUrl(request.url, origin);
  const publicRequest = isPublicMobileRequest(request.url);

  return defer(() => from(publicRequest ? Promise.resolve(null) : auth.nativeAccessToken())).pipe(
    switchMap((token) => next(withNativeCredentials(request, url, token)).pipe(
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !token || publicRequest) {
          return throwError(() => error);
        }
        return from(auth.nativeRefreshAfterUnauthorized(token)).pipe(
          switchMap((refreshedToken) => refreshedToken
            ? next(withNativeCredentials(request, url, refreshedToken))
            : throwError(() => error)),
        );
      }),
    )),
  );
};

function withNativeCredentials<T>(request: HttpRequest<T>, url: string, accessToken: string | null): HttpRequest<T> {
  const headers = accessToken
    ? request.headers.set('Authorization', `Bearer ${accessToken}`)
    : request.headers.delete('Authorization');
  return request.clone({ url, headers, withCredentials: false });
}

function isPublicMobileRequest(path: string): boolean {
  if (path === `${API_BASE_URL}/auth/mobile/login` || path === `${API_BASE_URL}/auth/mobile/register`) return true;
  if (/^\/api\/v1\/auth\/mobile\/invitations\/[^/]+\/register$/.test(path)) return true;
  if (/^\/api\/v1\/auth\/invitations\/[^/]+$/.test(path)) return true;
  return false;
}
