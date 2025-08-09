import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Fuzzy, ItemModel } from '@home/models';
import { ItemService } from '@home/services';
import { ItemComponent } from '../item/item.component';
import { ScrollService } from '@shared/services';
import { take } from 'rxjs';

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
export class ItemListComponent {
  private readonly itemService = inject(ItemService);
  private readonly scrollService = inject(ScrollService);
  public readonly isFuzzySearch = signal(false);
  public fuzzyData: Fuzzy = { items: [], keys: [] };

  private readonly _ = effect(() => {
    if (this.itemService.loading) {
      this.isFuzzySearch.set(false);
      this.fuzzyData = { items: [], keys: [] };
    }
  });
  private readonly _fuzzy = effect(() => {
    const noItems = this.itemService.noItems;
    const loading = this.itemService.loading;
    if (!noItems || loading) return;
    this.itemService.fuzzy
      .pipe(take(1))
      .subscribe({
        next: ({ data }) => {
          this.fuzzyData = data ?? { items: [], keys: [] };
          const hasAny = (this.fuzzyData.items.length ?? 0) + (this.fuzzyData.keys.length ?? 0) > 0;
          this.isFuzzySearch.set(hasAny);
        },
        error: () => {
          this.fuzzyData = { items: [], keys: [] };
          this.isFuzzySearch.set(false);
        }
      });
  });
  private readonly _load = effect(() => {
    if (!this.scrollService.isBottom()) return;
    if (this.loading || !this.hasNext) return;
    this.itemService.loading = true;
    this.itemService.more
      .subscribe({ next: () => { }, error: console.error })
      .add(() => {
        this.itemService.loading = false;
        this.scrollService.next = false;
      });
  });

  public get items(): ItemModel[] {
    return this.itemService.all;
  }

  public get empty(): boolean {
    return this.itemService.noItems;
  }

  public get loading(): boolean {
    return this.itemService.loading
  }

  public get hasNext(): boolean {
    return this.itemService.hasNext;
  }
  
  public readonly noData = computed(() => !this.itemService.loading && this.itemService.noItems && !this.isFuzzySearch());
}
