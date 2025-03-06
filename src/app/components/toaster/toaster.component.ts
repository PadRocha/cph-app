import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ToastService, ToastInfo } from '@core/services/toast/toast.service';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-toaster',
  imports: [CommonModule, NgbToastModule],
  templateUrl: './toaster.component.html',
  styleUrl: './toaster.component.scss',
  host: {
    class: "toaster position-fixed top-0 start-0 ps-2"
  }
})
export class ToasterComponent {
  
  constructor(
    private toast: ToastService,
  ) { }

  public className({ type }: ToastInfo): "bg-success" | "bg-warning" | "bg-danger" {
    switch (type) {
      case 'success':
        return 'bg-success';
      case 'warning':
        return 'bg-warning';
      case 'danger':
        return 'bg-danger';
    }
  }

  public get toasts(): ToastInfo[] {
    return this.toast.get();
  }

  public remove(toast: ToastInfo): void {
    this.toast.remove(toast);
  }
}
