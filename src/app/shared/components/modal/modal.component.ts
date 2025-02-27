import {
  Component,
  Input,
  Output,
  EventEmitter,
  TemplateRef,
  ContentChild,
  AfterContentInit,
  OnDestroy,
  HostListener,
  Renderer2,
  Inject,
} from "@angular/core";
import { CommonModule, DOCUMENT } from "@angular/common";
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from "@angular/animations";

export interface ModalEvent {
  relatedTarget?: HTMLElement;
}

@Component({
  selector: "app-modal",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./modal.component.html",
  styleUrls: ["./modal.component.scss"],
  animations: [
    trigger("modalState", [
      state("visible", style({ opacity: 1, transform: "scale(1)" })),
      state("void", style({ opacity: 0, transform: "scale(0.9)" })),
      transition("void => visible", [animate("300ms ease-out")]),
      transition("visible => void", [animate("300ms ease-in")]),
    ]),
  ],
})
export class ModalComponent implements AfterContentInit, OnDestroy {
  @Input() backdrop: boolean | "static" = true;
  @Input() keyboard: boolean = true;
  @Input() animated: boolean = true;
  @Input() size: "sm" | "lg" | "xl" | "fullscreen" | null = null;

  @Output() onShow = new EventEmitter<ModalEvent>();
  @Output() onShown = new EventEmitter<void>();
  @Output() onHide = new EventEmitter<void>();
  @Output() onHidden = new EventEmitter<void>();
  @Output() onHidePrevented = new EventEmitter<void>();

  @ContentChild("modalHeader") headerTemplate!: TemplateRef<any>;
  @ContentChild("modalBody") bodyTemplate!: TemplateRef<any>;
  @ContentChild("modalFooter") footerTemplate!: TemplateRef<any>;

  isOpen = false;
  private bodyClass = "modal-open";

  constructor(
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngAfterContentInit(): void {
    // Se puede hacer algo al detectar contenido, si se desea.
  }

  ngOnDestroy(): void {
    if (this.isOpen) {
      this.restoreBody();
    }
  }

  // Mostrar el modal
  show(relatedTarget?: HTMLElement): void {
    if (this.isOpen) {
      return;
    }
    this.onShow.emit({ relatedTarget });
    this.isOpen = true;
    this.preventBodyScroll();
    // Se emite onShown al final de la animación.
    if (this.animated) {
      // Usamos setTimeout para simular el fin de la animación (300ms)
      setTimeout(() => this.onShown.emit(), 300);
    } else {
      this.onShown.emit();
    }
  }

  // Ocultar el modal
  hide(): void {
    if (!this.isOpen) {
      return;
    }
    this.onHide.emit();
    this.isOpen = false;
    // Al final de la animación (o inmediatamente si no animated)
    if (this.animated) {
      setTimeout(() => {
        this.restoreBody();
        this.onHidden.emit();
      }, 300);
    } else {
      this.restoreBody();
      this.onHidden.emit();
    }
  }

  // Alternar modal
  toggle(): void {
    this.isOpen ? this.hide() : this.show();
  }

  // Destruir el modal (para modales creados dinámicamente)
  dispose(): void {
    this.hide();
    // Aquí se podrían limpiar suscripciones o referencias si se hubiera creado dinámicamente.
  }

  // Actualiza la posición del modal en caso de que cambie su contenido
  handleUpdate(): void {
    // Ejemplo: si el contenido aumenta, podríamos recalcular la posición centrada
    // En este ejemplo, el modal está centrado con flexbox, pero si fuese necesario
    // podríamos forzar una relectura de las dimensiones:
    const modalDialog = this.document.querySelector(
      ".modal-dialog"
    ) as HTMLElement;
    if (modalDialog) {
      // Por ejemplo, recalcular un margin-top si es necesario (aquí lo dejamos como placeholder)
      const viewportHeight = window.innerHeight;
      const modalHeight = modalDialog.offsetHeight;
      const topMargin = Math.max((viewportHeight - modalHeight) / 2, 20);
      this.renderer.setStyle(modalDialog, "margin-top", `${topMargin}px`);
    }
  }

  // Manejador de click en el backdrop
  onBackdropClick(): void {
    if (this.backdrop === "static") {
      this.onHidePrevented.emit();
    } else {
      this.hide();
    }
  }

  // Manejador de tecla Escape
  @HostListener("document:keydown.escape", ["$event"])
  onEscape(event: KeyboardEvent): void {
    if (!this.keyboard) {
      this.onHidePrevented.emit();
      return;
    }
    if (this.isOpen) {
      this.hide();
    }
  }

  // Previene el scroll en el body al abrir el modal
  private preventBodyScroll(): void {
    this.renderer.addClass(this.document.body, this.bodyClass);
  }

  // Restaura el scroll del body al cerrar el modal
  private restoreBody(): void {
    this.renderer.removeClass(this.document.body, this.bodyClass);
  }

  // Calcula la clase de tamaño según el Input "size"
  get sizeClass(): string {
    switch (this.size) {
      case "sm":
        return "modal-sm";
      case "lg":
        return "modal-lg";
      case "xl":
        return "modal-xl";
      case "fullscreen":
        return "modal-fullscreen";
      default:
        return "";
    }
  }
}
