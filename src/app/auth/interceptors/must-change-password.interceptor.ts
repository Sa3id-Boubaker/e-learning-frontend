import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, throwError } from 'rxjs';

const MUST_CHANGE_PASSWORD_MESSAGE = 'You must change your password before continuing.';
const FORCE_CHANGE_PASSWORD_ROUTE = '/force-change-password';

/**
 * Catches the one specific 403 the backend can return from ANY authenticated endpoint
 * while a forced password change is pending, and bounces the user to the dedicated
 * screen for it. Every other error (including other 403s) passes through untouched so
 * existing per-component error handling keeps working as before.
 */
export const mustChangePasswordInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isMustChangePassword =
        error instanceof HttpErrorResponse && error.status === 403 && error.error?.message === MUST_CHANGE_PASSWORD_MESSAGE;

      if (!isMustChangePassword) {
        return throwError(() => error);
      }

      if (router.url !== FORCE_CHANGE_PASSWORD_ROUTE) {
        void router.navigateByUrl(FORCE_CHANGE_PASSWORD_ROUTE);
      }

      return EMPTY;
    })
  );
};
