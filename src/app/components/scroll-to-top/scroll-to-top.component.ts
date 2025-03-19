import { Component, HostBinding, HostListener, OnInit, Renderer2, inject, input } from '@angular/core';

/**
 * Componente que muestra un botón para desplazar la vista hacia el inicio del contenedor.
 *
 * Se encarga de detectar el scroll del contenedor asignado y, si se sobrepasa
 * un umbral, muestra el botón que al hacer click desplaza el contenedor al tope.
 *
 * @example
 * ```html
 * <scroll-to-top [container]="myScrollableElement"></scroll-to-top>
 * ```
 */
@Component({
  selector: 'scroll-to-top',
  imports: [],
  template: '',
  styleUrl: './scroll-to-top.component.scss'
})
export class ScrollToTopComponent implements OnInit {
  private readonly renderer = inject(Renderer2);
  /**
   * Umbral (en porcentaje de scroll) a partir del cual se muestra el botón.
   *
   * Valor interno por defecto: 0.5 (50%).
   */
  private toggleRatio: number = 0.5;

  /**
   * Contenedor sobre el cual se debe escuchar el evento de scroll.
   *
   * Se debe asignar mediante el decorador @Input().
   */
  readonly container = input.required<HTMLElement>();

  /**
   * Controla la visibilidad del botón mediante una clase CSS.
   *
   * Si es true, se agrega la clase 'showBtn' al host, mostrando el botón.
   */
  @HostBinding('class.showBtn') showBtn: boolean = false;

  /**
   * Inicializa el componente y configura el listener de scroll sobre el contenedor.
   */
  ngOnInit(): void {
    const container = this.container();
    if (container) {
      this.renderer.listen(container, 'scroll', (event) => this.onScroll(event));
    }
  }

  /**
   * Manejador del evento de scroll.
   *
   * Calcula el porcentaje de scroll y actualiza la propiedad showBtn en base al umbral.
   *
   * @param event - Evento de scroll con target tipado como HTMLElement.
   */
  private onScroll({ target: { scrollHeight, clientHeight, scrollTop } }: Event & { target: HTMLElement }): void {
    const total = scrollHeight - clientHeight;
    const percent = scrollTop / total;
    this.showBtn = percent > this.toggleRatio;
  }

  /**
   * Al hacer click en el host, desplaza suavemente el contenedor al tope.
   *
   * Se utiliza el decorador @HostListener para escuchar el evento click.
   */
  @HostListener('click')
  scrollToTop(): void {
    const container = this.container();
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
