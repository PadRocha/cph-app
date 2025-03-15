import { Directive, ElementRef, Renderer2, computed, effect, Signal } from '@angular/core';
import { StorageService } from '@core/services';

@Directive({
  selector: '[app-theme]'
})
export class ThemeDirective {
  private attr: string;

  constructor(
    private element: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private storage: StorageService
  ) {
    this.attr = 'data-bs-theme';
    effect(() => {
      const theme = this.storage.theme;
      if (theme === 'auto') {
        this.renderer.removeAttribute(this.element.nativeElement, this.attr);
      } else {
        this.renderer.setAttribute(this.element.nativeElement, this.attr, theme);
      }
    });
  }
}
