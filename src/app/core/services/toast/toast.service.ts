import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

export interface ToastInfo {
  header: string;
  type: 'success' | 'warning' | 'danger';
  delay: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts: ToastInfo[];

  constructor(
    @Inject(PLATFORM_ID) private plataform: Object,
  ) {
    this.toasts = [];
  }

  public show(
    header: string,
    type: 'success' | 'warning' | 'danger',
  ): void {
    if (isPlatformBrowser(this.plataform)) {
      let delay: number;
      switch (type) {
        case 'success':
          delay = 5_000;
          break;
        case 'warning':
          delay = 10_000;
          break;
        case 'danger':
          delay = 20_000;
          break;
        default:
          delay = 0;
          break;
      }
      this.toasts.push({ header, type, delay });
    }
  }

  public remove(toast: ToastInfo): void {
    this.toasts = this.toasts.filter((t) => t !== toast);
  }

  public get(): ToastInfo[] {
    return this.toasts;
  }

  public clear(): void {
    this.toasts.splice(0, this.toasts.length);
  }
}
