import { Component, inject } from "@angular/core";
import { RouterModule, RouterOutlet } from "@angular/router";

import { TitleBarComponent } from "@components";
import { ToasterComponent } from "./components/toaster/toaster.component";
import { ScrollToTopComponent } from "./components/scroll-to-top/scroll-to-top.component";
import { ScrollTrackerDirective, ThemeDirective } from "@shared/directives";
import { NavigationService, UserService } from "@core/services";

@Component({
  selector: "app-root",
  imports: [RouterOutlet, RouterModule, TitleBarComponent, ToasterComponent, ScrollToTopComponent, ScrollTrackerDirective],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  hostDirectives: [ThemeDirective],
})
export class AppComponent {
  private readonly _navigation = inject(NavigationService);
  private readonly user = inject(UserService);

  constructor() {
    //TODO: Remover cuando esté en producción, solo para pruebas
    this.user.update.subscribe({
      next: (info) => {
        this.user.info = info;
      },
      error: () => {
        this.user.destroy();
      }
    });
  }
}