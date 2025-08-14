import { Injectable, signal } from "@angular/core";

/** Opciones para temas, incluye automático */
type theme = "dark" | "light" | "auto";

/** Alcance de persistencia de la ubicación */
type LocationScope = "local" | "session";

@Injectable({ providedIn: "root" })
export class StorageService {
  private locationSignal = signal<string>("");
  private themeSignal = signal<theme>("auto");

  // NUEVO: controlar envío y persistencia
  private sendLocationHeaderSignal = signal<boolean>(true);
  private rememberLocationSignal = signal<LocationScope>("local");

  constructor() {
    // Cargar ubicación (prefiere session si existe; si no, local)
    const sLoc = sessionStorage.getItem("location");
    const lLoc = localStorage.getItem("location");
    this.locationSignal.set((sLoc ?? lLoc ?? "").trim());

    // Cargar flags (con defaults sensatos)
    const send = localStorage.getItem("location_send");
    if (send !== null) this.sendLocationHeaderSignal.set(send === "1");

    const scope = (localStorage.getItem("location_scope") as LocationScope) ?? "local";
    this.rememberLocationSignal.set(scope);

    // Tema (igual que antes)
    const theme = localStorage.getItem("theme") as theme;
    if (theme) this.themeSignal.set(theme);

    if (window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      if (this.theme === "auto") this.theme = media.matches ? "dark" : "light";
      media.addEventListener("change", ({ matches }: MediaQueryListEvent) => {
        if (this.theme === "auto") this.theme = matches ? "dark" : "light";
      });
    }
  }

  /** Establece la ubicación y la persiste según el alcance seleccionado. */
  public set location(value: string) {
    const v = (value || "").trim();
    this.locationSignal.set(v);

    // Limpieza cruzada para evitar residuos inconsistentes
    sessionStorage.removeItem("location");
    localStorage.removeItem("location");

    if (!v) return;

    if (this.rememberLocationSignal() === "local") {
      localStorage.setItem("location", v);
    } else {
      sessionStorage.setItem("location", v);
    }
  }

  /** Obtiene la ubicación actual (puede ser cadena vacía). */
  public get location(): string {
    return this.locationSignal();
  }

  /** Borra la ubicación de memoria y almacenamiento. */
  public clearLocation(): void {
    this.location = "";
  }

  /** Controla si el interceptor debe enviar el encabezado. */
  public set sendLocationHeader(value: boolean) {
    this.sendLocationHeaderSignal.set(value);
    localStorage.setItem("location_send", value ? "1" : "0");
  }
  public get sendLocationHeader(): boolean {
    return this.sendLocationHeaderSignal();
  }

  /** Controla dónde se persiste la ubicación (local o session). Migra el valor actual. */
  public set rememberLocation(scope: LocationScope) {
    this.rememberLocationSignal.set(scope);
    localStorage.setItem("location_scope", scope);
    // Re-persiste el valor actual al nuevo destino
    this.location = this.locationSignal();
  }
  public get rememberLocation(): LocationScope {
    return this.rememberLocationSignal();
  }

  /**
   * Valor efectivo para el interceptor: null si está deshabilitado o vacío.
   * Nota: usa 'location' como nombre de header porque tu backend ya lo espera así.
   * Considera cambiarlo a 'X-Location' si no hay dependencia del servidor.
   */
  public get effectiveLocationForHeader(): string | null {
    if (!this.sendLocationHeaderSignal()) return null;
    const v = (this.locationSignal() || "").trim();
    return v.length ? v : null;
  }

  // Tema (sin cambios)
  public set theme(value: theme) {
    if (value === "auto") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", value);
    }
    this.themeSignal.set(value);
  }
  public get theme(): theme {
    return this.themeSignal();
  }
}
