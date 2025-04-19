import { Component, inject, OnInit } from "@angular/core";
import { RouterModule, RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { TitleBarComponent } from "@components";
import { ToasterComponent } from "./components/toaster/toaster.component";
import { ScrollToTopComponent } from "./components/scroll-to-top/scroll-to-top.component";
import { ThemeDirective } from "@shared/directives";
import { NavigationService, UserService } from "@core/services";

@Component({
  selector: "app-root",
  imports: [CommonModule, RouterOutlet, RouterModule, TitleBarComponent, ToasterComponent, ScrollToTopComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  hostDirectives: [ThemeDirective],
})
export class AppComponent {
  private readonly _navigation = inject(NavigationService);

  constructor(private user: UserService) {
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