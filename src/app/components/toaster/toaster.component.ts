import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService, ToastInfo } from '@core/services/toast/toast.service';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-toaster',
  imports: [CommonModule, NgbToastModule],
  templateUrl: './toaster.component.html',
  styleUrl: './toaster.component.scss',
  host: {
    class: 'toaster position-fixed top-0 start-0 ps-3'
  }
})
export class ToasterComponent {
  private readonly toast = inject(ToastService)

  /** Devuelve la clase CSS asociada al tipo de toast.
   *
   * @param toast - Información del toast.
   * @returns La clase CSS ("bg-success", "bg-warning" o "bg-danger").
   */
  public className({ type }: ToastInfo): string {
    return { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[type];
  }

  /** Obtiene la lista de toasts activos.
   *
   * @returns Arreglo de ToastInfo.
   */
  public get toasts(): ToastInfo[] {
    return this.toast.get();
  }

  /** Remueve un toast del listado.
   *
   * @param toast - El toast a remover.
   */
  public remove(toast: ToastInfo): void {
    this.toast.remove(toast);
  }
}
