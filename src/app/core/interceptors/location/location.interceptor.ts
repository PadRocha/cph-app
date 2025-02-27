import { HttpInterceptorFn } from '@angular/common/http';

export const locationInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
