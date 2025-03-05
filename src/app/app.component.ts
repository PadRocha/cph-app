import { Component, ElementRef, ViewChild } from "@angular/core";
import { RouterModule, RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { TitleBarComponent } from "@components";
import { StorageService } from "@core/services";
import { ToasterComponent } from "./components/toaster/toaster.component";
import { ScrollToTopComponent } from "./components/scroll-to-top/scroll-to-top.component";

@Component({
  selector: "app-root",
  imports: [CommonModule, RouterOutlet, RouterModule, TitleBarComponent, ToasterComponent, ScrollToTopComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {

  constructor(private storage: StorageService) {}

  public get theme() {
    return this.storage.theme === "auto" ? null : this.storage.theme;
  }
}
