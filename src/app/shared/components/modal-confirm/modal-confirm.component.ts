import { Component, computed, inject, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '@core/services';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CapitalizePipe } from '@shared/pipes';

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

@Component({
  selector: 'app-modal-confirm',
  imports: [ReactiveFormsModule, CapitalizePipe],
  templateUrl: './modal-confirm.component.html',
  styles: 'code { cursor: pointer; }',
})
export class ModalConfirmComponent {
  private readonly activeModal = inject(NgbActiveModal);
    private readonly toast = inject(ToastService);

  public context = model.required<ConfirmContext>();
  readonly confirmInput = new FormControl('', {
    validators: [Validators.required],
    nonNullable: true
  });
  readonly eventConfirm = toSignal(this.confirmInput.valueChanges, { initialValue: '' });
  readonly isValid = computed(() => this.eventConfirm() === this.context().token);
  readonly textButton = computed(() => `${this.context().intent} ${this.context().subject}`);

  public copyToken(): void {
    const text = this.context().token;
    if (text !== undefined && text !== null) {
      navigator.clipboard.writeText(text)
        .then(() => this.toast.show('Token copiado', 'El token ha sido copiado al portapapeles', 'success'))
        .catch(err => console.error('Error copiando el token: ', err));
    }
  }

  public confirm(): void {
    if (this.isValid()) {
      this.activeModal.close('confirmed');
    }
  }

  public cancel(): void {
    this.activeModal.dismiss('cancelled');
  }
}
