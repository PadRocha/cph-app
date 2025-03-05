import { isPlatformBrowser } from "@angular/common";
import {
  Inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  signal,
  WritableSignal,
} from "@angular/core";

type theme = "dark" | "light" | "auto";

@Injectable({
  providedIn: "root",
})
export class StorageService {
  private locationSignal: WritableSignal<string | null>;
  private themeSignal: WritableSignal<theme>;

  constructor(@Inject(PLATFORM_ID) private platformId: InjectionToken<Object>) {
    this.locationSignal = signal(null);
    this.themeSignal = signal("auto");

    if (isPlatformBrowser(this.platformId)) {
      const location = localStorage.getItem("location");
      if (location) {
        this.locationSignal.set(location);
      }

      const theme = localStorage.getItem("theme") as theme;
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

  public get theme(): theme {
    return this.themeSignal();
  }
}
