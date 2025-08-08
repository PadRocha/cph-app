import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { Component, effect, inject, OnDestroy } from '@angular/core';
import { ItemModel } from '@home/models';
import { ItemService } from '@home/services';
import { ItemComponent } from '../item/item.component';
import { ScrollService } from '@shared/services';

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
  private readonly scrollService = inject(ScrollService);

  private readonly _load = effect(()=> {
    if (this.scrollService.isBottom()) {
      if (this.loading || !this.hasNext) return;
      this.itemService.loading = true;
      this.itemService.more
        .pipe()
        .subscribe({
          next: () => { },
          error: console.error
        })
        .add(() => {
          this.itemService.loading = false;
          this.scrollService.next = false;
        });      
    }
  });

  ngOnDestroy(): void {
    // this.observer.disconnect();
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

  public endScroll(): void {
    console.log('End of scroll reached');
  }
}
