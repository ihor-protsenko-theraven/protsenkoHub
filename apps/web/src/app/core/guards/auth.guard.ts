import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.user()) {
    return true;
  }
  if (auth.ready()) {
    return router.createUrlTree(['/login']);
  }
  return auth.bootstrap().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const app = router.createUrlTree(['/app/calendar']);
  if (auth.user()) {
    return app;
  }
  if (auth.ready()) {
    return true;
  }
  return auth.bootstrap().pipe(
    map(() => app),
    catchError(() => of(true)),
  );
};
