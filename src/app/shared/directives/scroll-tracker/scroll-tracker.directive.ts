import { Directive, effect, ElementRef, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ScrollService } from '@shared/services';
import { distinctUntilChanged, fromEvent, map, throttleTime } from 'rxjs';

@Directive({
  selector: '[scroll]'
})
export class ScrollTrackerDirective {
  private readonly ref = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(ScrollService);
  public ratio = input<number>(0.75);
  private readonly isBottom = toSignal(
    fromEvent(this.ref.nativeElement, 'scroll').pipe(
      throttleTime(100, undefined, { trailing: true }),
      map(() => {
        const { scrollTop, scrollHeight, clientHeight } = this.ref.nativeElement;
        return scrollTop / (scrollHeight - clientHeight || 1) >= this.ratio();
      }),
      distinctUntilChanged()
    ),
    { initialValue: false }
  );
  private _ = effect(() => this.service.next = this.isBottom());
}
