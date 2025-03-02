import {
  computed,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";

@Injectable({
  providedIn: "root",
})
export class HistoryService {
  private suppressNextEvent: boolean;
  private trail: WritableSignal<string[]>;
  private currentIndex: WritableSignal<number>;
  public currentUrl: Signal<string>;

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
        console.log("Historial:", this.trail());
        console.log("Índice actual:", this.currentIndex());
      }
    });
  }

  public goBack(): void {
    if (this.currentIndex() > 0) {
      this.suppressNextEvent = true;
      this.currentIndex.update((n) => n - 1);
      const previousUrl = this.trail()[this.currentIndex()];
      this.router.navigateByUrl(previousUrl);
    }
  }

  public goForward(): void {
    if (this.currentIndex() < this.trail().length - 1) {
      this.suppressNextEvent = true;
      this.currentIndex.update((n) => n + 1);
      const forwardUrl = this.trail()[this.currentIndex()];
      this.router.navigateByUrl(forwardUrl);
    }
  }

  public set index(index: number) {
    const hist = this.trail();
    if (index >= 0 && index < hist.length) {
      this.suppressNextEvent = true;
      this.currentIndex.set(index);
      this.router.navigateByUrl(hist[index]);
    }
  }

  public get index(): number {
    return this.currentIndex();
  }

  public getTrail(): string[] {
    return [...this.trail()];
  }

  public reload(): void {
    this.suppressNextEvent = true;
    this.router.navigateByUrl(this.currentUrl(), { skipLocationChange: true });
  }
}
