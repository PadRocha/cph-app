import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService, UserService } from '@core/services';

export const httpTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(UserService).token;
  if (token == null) return next(req);

  const newReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
  return next(newReq);
};
