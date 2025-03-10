import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { UserService } from '@core/services';
import { firstValueFrom, filter, take } from 'rxjs';

export const adminGuard: CanMatchFn = async () => {
  const user = inject(UserService);
  const router = inject(Router);
  
  await firstValueFrom(
    user.userSync.pipe(
      filter(u => u.identifier !== null),
      take(1)
    )
  );

  return user.hasRole('GRANT', 'ADMIN')
    ? true
    : router.createUrlTree(['/home']);
};
