import { Injectable } from '@angular/core';

export interface ToastAction {
  label: string;
  handler: () => void;
}

interface ToastOptions { 
  /** Duración (en milisegundos) que se mostrará el toast. */
  delay?: number; 
  autohide?: boolean; 
  action?: ToastAction 
}

/**
 * Interfaz que define la información de un toast.
 */
export interface ToastInfo extends ToastOptions {
  /** Encabezado o título del toast. */
  header: string;
  body: string;
  /** Tipo de toast, que define el estilo: 'success', 'warning' o 'danger'. */
  type: 'success' | 'warning' | 'danger';
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
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
    body: string,
    type: ToastInfo['type'] = 'success',
    delay?: number,
    options: ToastOptions = {},
  ): void {
    const defaults: Record<ToastInfo['type'], number> = {
      success: 5_000,
      warning: 10_000,
      danger: 20_000,
    };

    this.toasts.unshift({
      header,
      body,
      type,
      delay: delay ?? defaults[type],
      autohide: options.autohide ?? true,
      action: options.action,
      createdAt: new Date(),
    });
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
