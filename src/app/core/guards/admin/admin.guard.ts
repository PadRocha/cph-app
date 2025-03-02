import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { UserService } from '@core/services';

export const adminGuard: CanMatchFn = (route, segments) => {
  const user = inject(UserService);
  const router = inject(Router);

  if (user.hasRole("GRANT", "ADMIN")) return true;

  return router.createUrlTree(["/home"]);
};
