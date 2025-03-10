import { Routes } from '@angular/router';
import { adminGuard, editGuard, notLoggedGuard } from '@core/guards';
import { AuthComponent, PdfComponent } from '@routes';

export const routes: Routes = [
  {
    path: "home",
    canMatch: [editGuard],
    async loadComponent() {
      const m = await import("./routes/home/home.component");
      return m.HomeComponent;
    },
  },
  {
    path: "pdf",
    component: PdfComponent,
  },
  {
    path: "settings",
    canMatch: [adminGuard],
    async loadComponent() {
      const m = await import("./routes/settings/settings.component");
      return m.SettingsComponent;
    },
  },
  {
    path: "login",
    canActivate: [notLoggedGuard],
    component: AuthComponent,
  },
  {
    path: "**",
    redirectTo: "/login",
    pathMatch: "full",
  },
];
