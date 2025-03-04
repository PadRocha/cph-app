import { Component } from "@angular/core";
import { RouterModule, RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { TitleBarComponent } from "@components";

@Component({
  selector: "app-root",
  imports: [CommonModule, RouterOutlet, RouterModule, TitleBarComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent  {
}
