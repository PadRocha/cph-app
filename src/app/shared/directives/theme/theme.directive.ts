import { Directive, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { StorageService } from '@core/services';

@Directive({
  selector: '[app-theme]'
})
export class ThemeDirective implements OnInit {
  private attr: string;

  constructor(
    private element: ElementRef<HTMLElement>, 
    private renderer: Renderer2, 
    private storage: StorageService
  ) {
    this.attr = 'data-bs-theme';
  }

  ngOnInit(): void {
    const theme = this.storage.theme === "auto" ? null : this.storage.theme;
    if (theme == null) {
      this.renderer.removeAttribute(this.element.nativeElement, this.attr);
    } else {
      this.renderer.setAttribute(this.element.nativeElement, this.attr, theme);
    }
  }
}
