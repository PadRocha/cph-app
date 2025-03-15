import { Directive, effect, ElementRef, Input, OnChanges, Renderer2, SimpleChanges } from '@angular/core';
import { status } from '@home/models';
import { ItemService } from '@home/services';

@Directive({
  selector: '[status]'
})
export class StatusButtonDirective implements OnChanges {
  @Input('status') buttonStatus!: status;
  @Input() active!: status;

  constructor(private el: ElementRef<HTMLButtonElement>, private renderer: Renderer2, private item: ItemService) {
    effect(() => {
      const total = this.item.total;
      this.updateAttributes();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['buttonStatus'] || changes['active']) {
      this.updateAttributes();
    }
  }

  private updateAttributes(): void {
    const name = this.item.statusName(this.buttonStatus);
    const value = this.item.statusValue(name);

    this.renderer.setAttribute(this.el.nativeElement, 'id', name);
    this.renderer.setAttribute(this.el.nativeElement, 'name', name);
    this.renderer.setAttribute(this.el.nativeElement, 'data-info', value.toString());
    this.renderer.setAttribute(this.el.nativeElement, 'title', `Buscar status "${name}"`);

    let className = `idN${this.buttonStatus}`;
    if (this.active === this.buttonStatus) {
      className += ' active';
    }

    this.renderer.setAttribute(this.el.nativeElement, 'class', `flex-grow-1 rounded px-1 ${className}`);

    let span = this.el.nativeElement.querySelector('span');
    if (!span) {
      span = this.renderer.createElement('span');
      this.renderer.appendChild(this.el.nativeElement, span);
    }

    this.renderer.setAttribute(span, 'class', `ico-${name}`);
  }
}
