import { effect, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ModalConfirmComponent } from '@shared/components';
import { filter } from 'rxjs';

interface ConfirmContext {
  /** Verbo: ¿qué se quiere hacer? */
  intent: 'remover' | 'resetear' | 'eliminar' | 'actualizar' | 'guardar' | 'editar';
  /** Tipo de entidad sobre la que se actúa. Ej: 'imagen', 'usuario' */
  subject: string;
  /** Identificador o nombre visible del sujeto. */
  // reference: string;
  /** Texto que se debe escribir para confirmar la acción. */
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  private readonly router = inject(Router);
  private readonly modal = inject(NgbModal);

  private modalRef: NgbModalRef | null = null;
  
  private eventNavigation = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ),
    { initialValue: null }
  );
  readonly effectNavigation = effect(() => {
    const event = this.eventNavigation();
    if (event) {
      this.close();
    }
  });

  async ask(context: ConfirmContext): Promise<boolean> {
    if (this.modalRef) {
      this.modalRef.dismiss('force-closed');
    }

    this.modalRef = this.modal.open(ModalConfirmComponent, {
      backdrop: 'static',
      keyboard: false,
      animation: true,
      centered: true,
      backdropClass: "blurred-backdrop"
    });

    const instance = this.modalRef.componentInstance as ModalConfirmComponent;
    instance.context.set(context);

    try {
      const result = await this.modalRef.result;
      this.modalRef = null;
      return result === 'confirmed';
    } catch {
      this.modalRef = null;
      return false;
    }
  }

  public close(): void {
    if (this.modalRef) {
      this.modalRef.dismiss('manually-closed');
      this.modalRef = null;
    }
  }
}
