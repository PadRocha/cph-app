import {
  computed,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";

/**
 * Servicio para gestionar el historial de navegación de la aplicación.
 *
 * Este servicio mantiene una "traza" de URLs visitadas y permite navegar hacia atrás,
 * adelante o recargar la URL actual.
 *
 * @remarks
 * La propiedad `suppressNextEvent` se utiliza internamente para evitar la duplicación
 * de eventos al navegar programáticamente.
 */
@Injectable({
  providedIn: "root",
})
export class HistoryService {
  /** Indica si se debe suprimir el próximo evento de navegación. */
  private suppressNextEvent: boolean;
  /** Señal que almacena la lista de URLs del historial. */
  private trail: WritableSignal<string[]>;
  /** Señal que almacena el índice actual en el historial. */
  private currentIndex: WritableSignal<number>;
  /** Computado que retorna la URL actual basada en el índice. */
  private currentUrl: Signal<string>;

  /**
   * Crea una instancia de HistoryService.
   *
   * @param router - Router de Angular para suscribirse a los eventos de navegación.
   */
  constructor(private router: Router) {
    this.suppressNextEvent = false;
    this.trail = signal([]);
    this.currentIndex = signal(-1);
    this.currentUrl = computed(() => {
      const hist = this.trail();
      const idx = this.currentIndex();
      return idx >= 0 && idx < hist.length ? hist[idx] : "/";
    });
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        if (this.suppressNextEvent) {
          this.suppressNextEvent = false;
          return;
        }
        const hist = this.trail();
        const idx = this.currentIndex();
        if (idx < hist.length - 1) this.trail.set(hist.slice(0, idx + 1));

        const newTrail = [...this.trail(), event.urlAfterRedirects];
        this.trail.set(newTrail);
        this.currentIndex.set(newTrail.length - 1);
        // console.log("Historial:", this.trail());
        // console.log("Índice actual:", this.currentIndex());
      }
    });
  }

  /**
   * Navega hacia la URL anterior en el historial.
   */
  public goBack(): void {
    if (this.currentIndex() > 0) {
      this.suppressNextEvent = true;
      this.currentIndex.update((n) => n - 1);
      const previousUrl = this.trail()[this.currentIndex()];
      this.router.navigateByUrl(previousUrl);
    }
  }

  /**
   * Navega hacia la URL siguiente en el historial.
   */
  public goForward(): void {
    if (this.currentIndex() < this.trail().length - 1) {
      this.suppressNextEvent = true;
      this.currentIndex.update((n) => n + 1);
      const forwardUrl = this.trail()[this.currentIndex()];
      this.router.navigateByUrl(forwardUrl);
    }
  }

  /**
   * Establece el índice actual del historial y navega a esa URL.
   *
   * @param index - El índice deseado en el historial.
   */
  public set index(index: number) {
    const hist = this.trail();
    if (index >= 0 && index < hist.length) {
      this.suppressNextEvent = true;
      this.currentIndex.set(index);
      this.router.navigateByUrl(hist[index]);
    }
  }

  /**
   * Obtiene el índice actual en el historial.
   *
   * @returns El índice actual.
   */
  public get index(): number {
    return this.currentIndex();
  }

  /**
   * Retorna la URL actual basada en el historial.
   *
   * @returns La URL actual.
   */
  public get url(): string {
    return this.currentUrl();
  }

  /**
   * Devuelve una copia del historial de navegación.
   *
   * @returns Un arreglo de URLs.
   */
  public getTrail(): string[] {
    return [...this.trail()];
  }

  /**
   * Recarga la URL actual sin actualizar la dirección en la barra de navegación.
   */
  public reload(): void {
    this.suppressNextEvent = true;
    this.router.navigateByUrl(this.currentUrl(), { skipLocationChange: true });
  }
}
