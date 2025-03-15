import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '@core/services';
import { firstValueFrom, take } from 'rxjs';

export const notLoggedGuard: CanActivateFn = async () => {
  const user = inject(UserService);
  const router = inject(Router);

  // Esperamos la primera emisión del estado del usuario (incluso si es el inicial)
  await firstValueFrom(user.userSync.pipe(take(1)));

  return !user.logged ? true : router.createUrlTree(['/home']);
};
