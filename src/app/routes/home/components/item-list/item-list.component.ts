import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { Component, DestroyRef, effect, ElementRef, inject, OnDestroy, viewChild } from '@angular/core';
import { ItemModel } from '@home/models';
import { ItemService } from '@home/services';
import { ItemComponent } from '../item/item.component';
import { first } from 'rxjs';

@Component({
  selector: 'item-list',
  imports: [ItemComponent],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.scss',
  animations: [
    trigger('listAnim', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger('100ms', [
            animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true }),
        query(':leave', [
          animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(20px)' }))
        ], { optional: true })
      ])
    ])
  ]
})
export class ItemListComponent implements OnDestroy {
  private readonly itemService = inject(ItemService);

  private readonly sentinel = viewChild.required<ElementRef<HTMLDivElement>>("sentinel");
  private readonly observer = new IntersectionObserver(
    ([{ isIntersecting, target }]) => {
      if (!isIntersecting || this.loading || !this.hasNext) return
      this.observer.unobserve(target);
      this.itemService.loading = true;
      this.itemService.more
        .pipe(first())
        .subscribe({
          next: () => { },
          error: console.error
        })
        .add(() => {
          this.itemService.loading = false;
          this.observer.observe(target);
        });
    },
    { rootMargin: '0px', threshold: 0 }
  );
  readonly _effectSentinel = effect(() => {
    const { nativeElement } = this.sentinel();
    this.observer.observe(nativeElement);
  });

  ngOnDestroy(): void {
    this.observer.disconnect();
  }

  public get items(): ItemModel[] {
    return this.itemService.all;
  }

  public get loading(): boolean {
    return this.itemService.loading
  }

  public get hasNext(): boolean {
    return this.itemService.hasNext;
  }
}
