import { HttpInterceptorFn } from '@angular/common/http';

export const httpTokenInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
