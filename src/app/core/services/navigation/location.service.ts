import { Location } from '@angular/common';
import { Injectable, signal, WritableSignal, computed, Signal } from '@angular/core';
import { Router, NavigationEnd, Navigation } from '@angular/router';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private history_signal: WritableSignal<string[]>;
  private current_index: WritableSignal<number>;
  private current_url: Signal<string>;

  // Subject que se activa cuando la navegación es manual
  private manualNavigation$: Subject<number>;

  constructor(private router: Router, private location: Location) {
    this.history_signal = signal([]);
    this.current_index = signal(-1);
    this.manualNavigation$ = new Subject();
    this.current_url = computed(() => {
      const history = this.history_signal();
      const index = this.current_index();
      return index >= 0 && index < history.length ? history[index] : '';
    });
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const new_url = event.urlAfterRedirects;
        if (new_url !== this.current_url()) {
          this.history_signal.update(history => [...history, new_url]);
          this.current_index.set(this.history_signal().length - 1);
        }
      });
  }

  public goBack(): void {
    // if (this.current_index() > 0) {
    //   this.current_index.update(index => index - 1);
    //   const target_url = this.current_url();
    //   // Emitimos que la navegación se hizo de forma manual
    //   this.manualNavigation$.next(0);
    //   this.router.navigateByUrl(target_url);
    // }
    this.location.back()

    console.log(this.router.lastSuccessfulNavigation?.finalUrl);
    // this.navigation.
  }

  public goForward(): void {
    if (this.current_index() < this.history_signal().length - 1) {
      this.current_index.update(index => index + 1);
      const target_url = this.current_url();
      this.manualNavigation$.next(1);
      this.router.navigateByUrl(target_url);
    }
  }

  public setIndex(new_index: number): void {
    const history = this.history_signal();
    if (new_index >= 0 && new_index < history.length) {
      this.current_index.set(new_index);
      // Se activa la navegación manual
      this.manualNavigation$.next(2);
      console.log('history', history[new_index], this.current_url());

      this.router.navigateByUrl(history[new_index], { onSameUrlNavigation: 'reload', skipLocationChange: true });
    } else {
      console.error('Índice fuera de rango');
    }
  }

  public get index(): number {
    return this.current_index();
  }

  public get url(): string {
    return this.current_url();
  }

  public get history(): string[] {
    return this.history_signal();
  }

  public get manual() {
    return this.manualNavigation$;
  }

  public reload(): void {
    this.router.navigateByUrl(this.current_url());
  }
}
