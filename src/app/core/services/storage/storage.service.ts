import { isPlatformBrowser } from "@angular/common";
import {
  Inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  signal,
  WritableSignal,
} from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class StorageService {
  private locationSignal: WritableSignal<string | null>;
  private themeSignal: WritableSignal<string | null>;

  constructor(@Inject(PLATFORM_ID) private platformId: InjectionToken<Object>) {
    this.locationSignal = signal(null);
    this.themeSignal = signal(null);

    if (isPlatformBrowser(this.platformId)) {
      const location = localStorage.getItem("location");
      if (location) {
        this.locationSignal.set(location);
      }

      const theme = localStorage.getItem("theme");
      if (theme) {
        this.themeSignal.set(theme);
      }

      if (window.matchMedia) {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        if (this.theme == null) {
          this.theme = media.matches ? "dark" : "light";
        }

        media.addEventListener("change", (event: MediaQueryListEvent) => {
          if (this.theme == null) {
            this.theme = event.matches ? "dark" : "light";
          }
        });
      }
    }
  }

  public set location(value: string | null) {
    if (isPlatformBrowser(this.platformId)) {
      if (value === null) {
        localStorage.removeItem("location");
      } else {
        localStorage.setItem("location", value);
      }
    }
    this.locationSignal.set(value);
  }

  public get location(): string | null {
    return this.locationSignal();
  }

  public set theme(value: string | null) {
    if (isPlatformBrowser(this.platformId)) {
      if (value === null) {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", value);
      }
    }
    this.themeSignal.set(value);
  }

  public get theme(): string | null {
    return this.themeSignal();
  }
}
