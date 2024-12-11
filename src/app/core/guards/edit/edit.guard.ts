import { CanActivateFn } from '@angular/router';

export const editGuard: CanActivateFn = (route, state) => {
  return true;
};
