import { trigger, transition, style, animate } from '@angular/animations';
import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ThemeDirective } from '@shared/directives';

@Component({
  selector: 'app-modal-help',
  imports: [],
  templateUrl: './modal-help.component.html',
  styleUrl: './modal-help.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(4px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ],
  hostDirectives: [ThemeDirective],
})
export class ModalHelpComponent {
  private readonly active = inject(NgbActiveModal);

  public close(): void {
    this.active.close();
  }
}
