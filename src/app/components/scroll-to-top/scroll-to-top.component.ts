import { Component, HostBinding, HostListener, Input, OnInit, Renderer2 } from '@angular/core';

@Component({
  selector: 'scroll-to-top',
  imports: [],
  template: '',
  styleUrl: './scroll-to-top.component.scss'
})
export class ScrollToTopComponent implements OnInit {
  private toggleRatio: number = 0.5;
  @Input() container!: HTMLElement;
  @HostBinding('class.showBtn') showBtn: boolean = false;

  constructor(private renderer: Renderer2) { }

  ngOnInit() {
    if (this.container) {
      this.renderer.listen(this.container, 'scroll', (event) => this.onScroll(event));
    }
  }

  private onScroll({ target: { scrollHeight, clientHeight, scrollTop } }: Event & { target: HTMLElement }): void {
    const total = scrollHeight - clientHeight;
    const percent = scrollTop / total;
    this.showBtn = percent > this.toggleRatio;
  }

  @HostListener('click')
  scrollToTop(): void {
    if (this.container) {
      this.container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
