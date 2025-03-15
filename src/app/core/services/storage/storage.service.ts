import { isPlatformBrowser } from "@angular/common";
import {
  Inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  signal,
  WritableSignal,
} from "@angular/core";

/** Opciones para temas, incluye automático */
type theme = "dark" | "light" | "auto";

/**
 * Servicio de almacenamiento local.
 *
 * Administra el guardado y recuperación de datos de configuración como la ubicación
 * y el tema visual, utilizando localStorage cuando se ejecuta en el navegador.
 *
 * @remarks
 * Además, este servicio observa cambios en el sistema de preferencia de color para
 * actualizar el tema cuando está configurado en "auto".
 */
@Injectable({
  providedIn: "root",
})
export class StorageService {
  /** Instancia del almacenamiento (localStorage en navegador). */
  private storage!: Storage;
  /** Señal que almacena la ubicación guardada o null. */
  private locationSignal: WritableSignal<string | null>;
  /** Señal que almacena el tema actual. */
  private themeSignal: WritableSignal<theme>;

  /**
   * Crea una instancia de StorageService.
   *
   * @param platformId - Token para detectar la plataforma de ejecución.
   */
  constructor(@Inject(PLATFORM_ID) private platformId: InjectionToken<Object>) {
    this.locationSignal = signal(null);
    this.themeSignal = signal("auto");

    if (isPlatformBrowser(this.platformId)) {
      this.storage = localStorage;

      const location = this.storage.getItem("location");
      if (location) {
        this.locationSignal.set(location);
      }

      const theme = this.storage.getItem("theme") as theme;
      if (theme) {
        this.themeSignal.set(theme);
      }

      if (window.matchMedia) {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        if (this.theme === 'auto') {
          this.theme = media.matches ? "dark" : "light";
        }

        media.addEventListener("change", (event: MediaQueryListEvent) => {
          if (this.theme === 'auto') {
            this.theme = event.matches ? "dark" : "light";
          }
        });
      }
    }
  }

  /**
   * Establece la ubicación y la guarda en el almacenamiento.
   *
   * @param value - La ubicación a guardar o null para eliminarla.
   */
  public set location(value: string | null) {
    if (isPlatformBrowser(this.platformId)) {
      if (value === null) {
        this.storage.removeItem("location");
      } else {
        this.storage.setItem("location", value);
      }
    }
    this.locationSignal.set(value);
  }

  /**
   * Obtiene la ubicación almacenada.
   *
   * @returns La ubicación guardada o null.
   */
  public get location(): string | null {
    return this.locationSignal();
  }

  /**
   * Establece el tema visual y lo guarda en el almacenamiento.
   *
   * @param value - El tema a establecer ("dark", "light" o "auto").
   */
  public set theme(value: theme) {
    if (isPlatformBrowser(this.platformId)) {
      if (value === "auto") {
        this.storage.removeItem("theme");
      } else {
        this.storage.setItem("theme", value);
      }
    }
    this.themeSignal.set(value);
  }

  /**
   * Obtiene el tema visual actual.
   *
   * @returns El tema ("dark", "light" o "auto").
   */
  public get theme(): theme {
    return this.themeSignal();
  }
}
