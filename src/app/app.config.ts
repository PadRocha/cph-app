import {
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import { ApplicationConfig, provideZoneChangeDetection } from "@angular/core";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { httpTokenInterceptor, locationInterceptor } from "@core/interceptors";

import { routes } from "./app.routes";

const interceptos: HttpInterceptorFn[] = [
  httpTokenInterceptor,
  locationInterceptor,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors(interceptos)),
  ],
};
