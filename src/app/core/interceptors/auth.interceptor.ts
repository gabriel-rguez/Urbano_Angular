import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
export const SKIP_SESSION_RESET = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();
  const isRefreshRequest = req.url.includes('/auth/refrescar');

  let authReq = req;
  // El refresh se autentica con su propio refreshToken. Un access token vencido
  // en este header haría que el gateway lo rechace antes de llegar al endpoint.
  if (token && !isRefreshRequest && !req.headers.has('Authorization')) {
    authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  return next(authReq).pipe(
    catchError((error) => {
      const isAuthCall = req.url.includes('/auth/login') || req.url.includes('/auth/refrescar');
      const skipSessionReset = req.context.get(SKIP_SESSION_RESET);
      if (error.status === 401 && !isAuthCall && token && !skipSessionReset) {
        return authService.refreshToken().pipe(
          switchMap(() => {
            const refreshedToken = authService.getToken();
            if (!refreshedToken) {
              return throwError(() => error);
            }

            return next(req.clone({
              headers: req.headers.set('Authorization', `Bearer ${refreshedToken}`)
            }));
          }),
          catchError((refreshError) => {
            authService.clearSession();
            if (!router.url.startsWith('/home') && router.url !== '/' && router.url !== '/login') {
              router.navigate(['/login']);
            }
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
