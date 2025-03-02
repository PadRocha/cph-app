import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { StorageService } from "@core/services";

export const locationInterceptor: HttpInterceptorFn = (req, next) => {
  const location = inject(StorageService).location;
  if (location == null) return next(req);

  const newReq = req.clone({
    setHeaders: { location },
  });
  return next(newReq);
};
