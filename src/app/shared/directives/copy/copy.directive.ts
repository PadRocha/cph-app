import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { ToastService } from '@core/services/toast/toast.service';

@Directive({
  selector: 'a[app-copy]'
})
export class CopyDirective {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly toast = inject(ToastService);

  @HostListener('click', ['$event'])
  async onClick(event: MouseEvent): Promise<void> {
    const div = event.target as HTMLElement;
    const text = div.textContent;
    if (text !== null) {
      await navigator.clipboard.writeText(text);
      this.toast.show('Copiado', 'success');
    }
  }
}
