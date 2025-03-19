import { isPlatformBrowser } from "@angular/common";
import { inject, Injectable, PLATFORM_ID, signal } from "@angular/core";

/** Opciones para temas, incluye automático */
type theme = "dark" | "light" | "auto";

@Injectable({
  providedIn: "root",
})
export class StorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private locationSignal = signal<string>('');
  private themeSignal = signal<theme>("auto");

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const location = localStorage.getItem("location");
      if (location) this.locationSignal.set(location);

      const theme = localStorage.getItem("theme") as theme;
      if (theme) this.themeSignal.set(theme);

      if (window.matchMedia) {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        if (this.theme === 'auto') this.theme = media.matches ? "dark" : "light";

        media.addEventListener("change", ({ matches }: MediaQueryListEvent) => {
          if (this.theme === 'auto') this.theme = matches ? "dark" : "light";
        });
      }
    }
  }

  /**
   * Establece la ubicación y la guarda en el almacenamiento.
   *
   * @param value - La ubicación a guardar o null para eliminarla.
   */
  public set location(value: string) {
    if (isPlatformBrowser(this.platformId)) {
      if (!value) {
        localStorage.removeItem("location");
      } else {
        localStorage.setItem("location", value);
      }
    }
    this.locationSignal.set(value);
  }

  /**
   * Obtiene la ubicación almacenada.
   *
   * @returns La ubicación guardada o null.
   */
  public get location(): string {
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
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", value);
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
