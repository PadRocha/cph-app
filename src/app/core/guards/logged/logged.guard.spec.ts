import { TestBed } from '@angular/core/testing';
import { CanMatchFn } from '@angular/router';

import { loggedGuard } from './logged.guard';

describe('loggedGuard', () => {
  const executeGuard: CanMatchFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => loggedGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
