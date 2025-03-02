import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '@core/services';

export const loggedGuard: CanMatchFn = () => {
  const isLogged = inject(AuthService).loggedIn;
  const router = inject(Router);

  if (isLogged) return true;

  return router.createUrlTree(["/home"]);
};
