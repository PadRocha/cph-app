import { Directive, effect, ElementRef, inject, input, Renderer2 } from '@angular/core';
import { status } from '@home/models';
import { ItemService } from '@home/services';

@Directive({
  selector: '[status]'
})
export class StatusButtonDirective {
  private readonly ref = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly item = inject(ItemService);

  readonly buttonStatus = input.required<status>({ alias: "status" });
  readonly active = input.required<status>();
  readonly effectChanges = effect(() => {
    const status = this.buttonStatus();
    const active = this.active();
    const name = this.item.statusName(status);
    const value = this.item.statusValue(name);
    const { nativeElement } = this.ref;

    this.renderer.setAttribute(nativeElement, 'id', name);
    this.renderer.setAttribute(nativeElement, 'name', name);
    this.renderer.setAttribute(nativeElement, 'data-info', value.toString());
    this.renderer.setAttribute(nativeElement, 'title', `Buscar status "${name}"`);

    let className = `idN${status}`;
    if (active === status) className += ' active';

    this.renderer.setAttribute(nativeElement, 'class', `flex-grow-1 rounded px-1 ${className}`);

    let span = nativeElement.querySelector('span');
    if (!span) {
      span = this.renderer.createElement('span');
      this.renderer.appendChild(nativeElement, span);
    }

    this.renderer.setAttribute(span, 'class', `ico-${name}`);
  });
}
