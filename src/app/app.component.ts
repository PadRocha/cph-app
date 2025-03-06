import { Component } from "@angular/core";
import { RouterModule, RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { TitleBarComponent } from "@components";
import { ToasterComponent } from "./components/toaster/toaster.component";
import { ScrollToTopComponent } from "./components/scroll-to-top/scroll-to-top.component";
import { ThemeDirective } from "@shared/directives";

@Component({
  selector: "app-root",
  imports: [CommonModule, RouterOutlet, RouterModule, TitleBarComponent, ToasterComponent, ScrollToTopComponent, ThemeDirective],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {

  constructor() {}
}
