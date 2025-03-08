import { Directive, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { StorageService } from '@core/services';

/**
 * Directiva que aplica el tema visual al elemento host.
 *
 * Esta directiva utiliza el valor del tema configurado en el StorageService
 * para establecer o remover el atributo `data-bs-theme` en el elemento al que
 * se aplica. Si el tema es "auto", se elimina el atributo; de lo contrario,
 * se asigna el valor del tema.
 *
 * @example
 * ```html
 * <div app-theme></div>
 * ```
 */
@Directive({
  selector: '[app-theme]'
})
export class ThemeDirective implements OnInit {
  /**
   * Nombre del atributo que se utiliza para definir el tema.
   *
   * Por defecto, este valor es "data-bs-theme".
   */
  private attr: string;

  /**
   * Crea una instancia de ThemeDirective.
   *
   * @param element - Referencia al elemento host de la directiva.
   * @param renderer - Servicio para manipular el DOM de forma segura.
   * @param storage - Servicio que proporciona la configuración del tema.
   */
  constructor(
    private element: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private storage: StorageService
  ) {
    this.attr = 'data-bs-theme';
  }

  /**
   * Método de ciclo de vida OnInit.
   *
   * En la inicialización, se obtiene el tema desde el StorageService. Si el
   * tema es "auto", se remueve el atributo del elemento; en caso contrario,
   * se establece el atributo con el valor del tema.
   */
  ngOnInit(): void {
    const theme = this.storage.theme === "auto" ? null : this.storage.theme;
    if (theme == null) {
      this.renderer.removeAttribute(this.element.nativeElement, this.attr);
    } else {
      this.renderer.setAttribute(this.element.nativeElement, this.attr, theme);
    }
  }
}
