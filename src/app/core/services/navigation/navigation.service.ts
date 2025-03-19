import { Location } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Params, Router } from '@angular/router';
import { filter } from 'rxjs';
import { UserService } from '../user/user.service';

export interface Historian {
  id: number;
  route: string;
  base: string;
  params: Params
  past: string | null;
  future: string | null;  
}

interface RouteAuth {
  [route: string]: ('EDIT' | 'GRANT' | 'ADMIN')[];
}

const initialPresent: Historian = {
  id: 0,
  route: '',
  base: '',
  params: {},
  past: null,
  future: null,
};

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly user = inject(UserService);
  private readonly permissions: RouteAuth = {
    "/pdf": [],
    "/login": [],
    "/home": ["EDIT", "GRANT", "ADMIN"],
    "/settings": ["GRANT", "ADMIN"],
  };
  private counter = 0;
  private past = signal<Historian[]>([]);
  private present = signal(initialPresent);
  private future = signal<Historian[]>([]);

  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const route = event.urlAfterRedirects;
        const decodedRoute = decodeURIComponent(route);
        const [base] = decodedRoute.split('?');
        const urlTree = this.router.parseUrl(route);
        const params = urlTree.queryParams;

        if (!this.present().route) {
          this.present.set({
            id: ++this.counter,
            route,
            base,
            params,
            past: null,
            future: null,
          });
          return;
        }

        const newPast = this.present();
        if (newPast.route === route) return;
        this.past.update((history) => [...history.filter((route) => this.canAccessRoute(route)), newPast]);
        this.future.set([]);
        this.present.set({
          id: ++this.counter,
          route,
          base,
          params,
          past: newPast ? newPast.route : null,
          future: null,
        });
      });
  }

  private canAccessRoute({ base }: Historian): boolean {
    const requiredRoles = this.permissions[base];
    if (!requiredRoles || requiredRoles.length < 1) return true;
    return this.user.hasRole(...requiredRoles);
  }

  public goBack(): void {
    const pastRoutes = this.past();
    if (pastRoutes.length > 0) {
      const newPresent = pastRoutes.pop()!;
      const newPast = this.present();
      if (newPast) this.future.update((history) => [newPast, ...history]);
      this.past.set(pastRoutes);
      this.present.set(newPresent);
      this.router.navigateByUrl(newPresent.route);
    } else {
      this.location.back();
    }
  }

  public goForward(): void {
    const futureRoutes = this.future();
    if (futureRoutes.length > 0) {
      const newPresent = futureRoutes.shift()!;
      const newFuture = this.present();
      if (newFuture) this.past.update((history) => [...history, newFuture]);
      this.future.set(futureRoutes);
      this.present.set(newPresent);
      this.router.navigateByUrl(newPresent.route);
    }
  }

  public get history(): Historian[] {
    return [...this.past(), this.present(), ...this.future()];
  }

  public set now(newId: number) {
    const combined = this.history;
    const newPresentIndex = combined.findIndex(({ id }) => id === newId);
    if (newPresentIndex === -1) return;
    const newPresent = combined.at(newPresentIndex);
    if (!newPresent) return;
    this.past.set(combined.slice(0, newPresentIndex).filter((route) => this.canAccessRoute(route)));
    this.present.set(newPresent);
    this.future.set(combined.slice(newPresentIndex + 1).filter((route) => this.canAccessRoute(route)));
    this.router.navigateByUrl(newPresent.route);
  }

  public get now(): Historian {
    return this.present();
  }

  public get hasPast(): boolean {
    return this.past().length > 0;
  }

  public get hasFuture(): boolean {
    return this.future().length > 0;
  }
}
