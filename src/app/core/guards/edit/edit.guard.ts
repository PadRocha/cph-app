import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { UserService } from '@core/services';

export const editGuard: CanMatchFn = () => {
  const user = inject(UserService);
  const router = inject(Router);

  if (user.hasRole("EDIT", "GRANT", "ADMIN")) return true;

  return router.createUrlTree(["/home"]);
};
