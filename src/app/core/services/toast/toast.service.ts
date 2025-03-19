import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

/**
 * Interfaz que define la información de un toast.
 */
export interface ToastInfo {
  /** Encabezado o título del toast. */
  header: string;
  /** Tipo de toast, que define el estilo: 'success', 'warning' o 'danger'. */
  type: 'success' | 'warning' | 'danger';
  /** Duración (en milisegundos) que se mostrará el toast. */
  delay: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly platformId = inject(PLATFORM_ID);
  private toasts: ToastInfo[] = [];

  /**
   * Muestra un toast en pantalla.
   *
   * @param header - Texto del encabezado del toast.
   * @param type - Tipo de toast ('success', 'warning' o 'danger').
   *
   * @remarks
   * La duración del toast se determina automáticamente según el tipo:
   * - success: 5000 ms
   * - warning: 10000 ms
   * - danger: 20000 ms
   */
  public show(
    header: string,
    type: 'success' | 'warning' | 'danger',
  ): void {
    if (isPlatformBrowser(this.platformId)) {
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

  /**
   * Remueve un toast específico.
   *
   * @param toast - El toast a remover.
   */
  public remove(toast: ToastInfo): void {
    this.toasts = this.toasts.filter((t) => t !== toast);
  }

  /**
   * Obtiene la lista de toasts activos.
   *
   * @returns Un arreglo con la información de cada toast.
   */
  public get(): ToastInfo[] {
    return this.toasts;
  }

  /**
   * Limpia todos los toasts activos.
   */
  public clear(): void {
    this.toasts.splice(0, this.toasts.length);
  }
}
