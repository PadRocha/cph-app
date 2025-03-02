import {
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import { ApplicationConfig, provideZoneChangeDetection } from "@angular/core";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideRouter, withDebugTracing, withRouterConfig } from "@angular/router";
import { httpTokenInterceptor, locationInterceptor } from "@core/interceptors";
import { environment } from "@environment";

import { routes } from "./app.routes";

const interceptors: HttpInterceptorFn[] = [
  httpTokenInterceptor,
  locationInterceptor,
];

const routesFeatures = environment.production ? [] : [withDebugTracing()];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withRouterConfig({ onSameUrlNavigation: "reload" }),
      ...routesFeatures
    ),
    provideAnimations(),
    provideHttpClient(withInterceptors(interceptors)),
  ],
};
