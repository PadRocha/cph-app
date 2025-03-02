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

  constructor(@Inject(PLATFORM_ID) private platformId: InjectionToken<Object>) {
    this.locationSignal = signal<string | null>(null);

    if (isPlatformBrowser(this.platformId)) {
      const location = localStorage.getItem("location");
      if (location) {
        this.locationSignal.set(location);
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
}
