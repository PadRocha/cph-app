import { CanMatchFn } from '@angular/router';

export const loggedGuard: CanMatchFn = (route, segments) => {
  return true;
};
