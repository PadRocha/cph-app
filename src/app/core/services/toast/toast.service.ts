import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

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

/**
 * Servicio para gestionar notificaciones tipo toast.
 *
 * Permite mostrar, remover, obtener y limpiar toasts.
 *
 * @remarks
 * Este servicio se asegura de que sólo se ejecuten métodos relacionados con la
 * manipulación de toasts cuando se está en un entorno de navegador.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  /** Arreglo interno de toasts activos. */
  private toasts: ToastInfo[];

  /**
   * Crea una instancia de ToastService.
   *
   * @param plataform - Token de plataforma para determinar si se ejecuta en navegador.
   */
  constructor(
    @Inject(PLATFORM_ID) private plataform: Object,
  ) {
    this.toasts = [];
  }

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
