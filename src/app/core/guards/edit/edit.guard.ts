import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { UserService } from '@core/services';
import { firstValueFrom, filter, take } from 'rxjs';

export const editGuard: CanMatchFn = async () => {
  const user = inject(UserService);
  const router = inject(Router);

  console.log('edit guard before');
  
  // Esperamos hasta que la identidad tenga un identifier válido
  await firstValueFrom(
    user.userSync.pipe(
      filter(u => u.identifier !== null),
      take(1)
    )
  );
  console.log('edit guard after');

  return user.hasRole('EDIT', 'GRANT', 'ADMIN')
    ? true
    : router.createUrlTree(['/pdf']);
};
