import { CanMatchFn } from '@angular/router';

export const editGuard: CanMatchFn = (route, segments) => {
  return true;
};
