import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@core/services';

export const httpTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token;
  const newReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(newReq);
};
