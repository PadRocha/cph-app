import { Component, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterOutlet } from "@angular/router";
import { ModalComponent } from "./shared/components/modal/modal.component";
import { CommonModule } from "@angular/common";
import { getCurrentWindow } from "@tauri-apps/api/window";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule, ModalComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
  async ngOnInit() {
    await getCurrentWindow().maximize();
  }

  @ViewChild("demoModal") demoModal!: ModalComponent;

  darkTheme: boolean = false;
  showExtraInfo: boolean = false;

  openModal(): void {
    // Configuramos contenido dinámico (por ejemplo, alternamos información extra)
    this.showExtraInfo = Math.random() > 0.5;
    // Podemos pasar como relatedTarget el botón (opcional)
    const btn = document.querySelector("button") as HTMLElement;
    this.demoModal.show(btn);
  }

  accion(): void {
    console.log("Acción confirmada");
    this.demoModal.hide();
  }

  onModalShow(event: any): void {
    console.log(
      "onShow - modal se está abriendo. relatedTarget =",
      event?.relatedTarget
    );
  }
  onModalShown(): void {
    console.log("onShown - modal ya visible");
  }
  onModalHide(): void {
    console.log("onHide - modal se está ocultando");
  }
  onModalHidden(): void {
    console.log("onHidden - modal oculto");
  }
  onModalHidePrevented(): void {
    console.warn(
      "Intento de cerrar modal prevenido (backdrop estático o keyboard false)"
    );
  }
}
