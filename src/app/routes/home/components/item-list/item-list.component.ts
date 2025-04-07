import { Component, inject, input } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { ThemeDirective } from '@shared/directives';
import { ItemService } from '@home/services';
import { ItemComponent } from '../item/item.component';
import { ItemModel } from '@home/models';

@Component({
  selector: 'item-list',
  imports: [ItemComponent, ThemeDirective],
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

  public loading = input.required<boolean>();

  public get items(): ItemModel[] {
    return this.itemService.all;
  }
}
