import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services';

export const notLoggedGuard: CanActivateFn = () => {
  const isLogged = inject(AuthService).loggedIn;
  const router = inject(Router);

  if (!isLogged) return true

  return router.createUrlTree(["/home"]);
};
