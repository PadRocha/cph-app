import { RouteReuseStrategy, ActivatedRouteSnapshot, DetachedRouteHandle } from "@angular/router";

export class CustomRouteReuseStrategy implements RouteReuseStrategy {

    handlers: { [key: string]: DetachedRouteHandle } = {};

    shouldDetach(route: ActivatedRouteSnapshot): boolean {
        return route.data["reuse"] || false;
    }

    store(route: ActivatedRouteSnapshot, handle: {}): void {
        if (route.data["reuse"]) {
            if (route.routeConfig && route.routeConfig.path) {
                this.handlers[route.routeConfig.path] = handle;
            }
        }
    }

    shouldAttach(route: ActivatedRouteSnapshot): boolean {
        return !!route.routeConfig && route.routeConfig.path !== undefined && !!this.handlers[route.routeConfig.path];
    }

    retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
        if (!route.routeConfig) return null;
        return route.routeConfig && route.routeConfig.path ? this.handlers[route.routeConfig.path] : null;
    }

    shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
        return future.data["reuse"] || false;
    }

}