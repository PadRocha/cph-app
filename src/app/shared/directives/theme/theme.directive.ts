import { Directive, ElementRef, Renderer2, computed, effect, Signal, inject } from '@angular/core';
import { StorageService } from '@core/services';

@Directive({
  selector: '[app-theme]'
})
export class ThemeDirective {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly storage = inject(StorageService);
  private readonly attr = 'data-bs-theme';

  themeChage = effect(() => {
    const theme = this.storage.theme;
    if (theme === 'auto') {
      this.renderer.removeAttribute(this.element.nativeElement, this.attr);
    } else {
      this.renderer.setAttribute(this.element.nativeElement, this.attr, theme);
    }
  });
}
