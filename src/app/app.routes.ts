import { Routes } from '@angular/router';
import { adminGuard, editGuard, notLoggedGuard } from '@core/guards';
import { LoginComponent, PdfComponent } from '@routes';

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
    path: "dashboard",
    canMatch: [adminGuard],
    async loadComponent() {
      const m = await import("./routes/dashboard/dashboard.component");
      return m.DashboardComponent;
    },
  },
  {
    path: "login",
    canActivate: [notLoggedGuard],
    component: LoginComponent,
  },
  {
    path: "**",
    redirectTo: "/login",
    pathMatch: "full",
  },
];
