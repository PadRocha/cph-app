import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { StorageService } from "@core/services";

export const locationInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(StorageService);
  const location = storage.effectiveLocationForHeader;
  if (!location) return next(req);

  // Si necesitas limitar por origen, podrías comprobar aquí el host del req.url
  // y omitir si es cross-origin.

  const newReq = req.clone({ setHeaders: { location } });
  return next(newReq);
};
