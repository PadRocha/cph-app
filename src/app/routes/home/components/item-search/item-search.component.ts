import { Component, inject, model, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Search, status } from '@home/models';
import { DecimalPipe } from '@angular/common';
import { ThemeDirective } from '@shared/directives';
import { StatusButtonDirective } from '@home/directives';
import { ItemService } from '@home/services';

type SearchControls = {
  [K in keyof Search]: FormControl<Search[K]>;
};

@Component({
  selector: 'item-search',
  imports: [DecimalPipe, ThemeDirective, StatusButtonDirective, ReactiveFormsModule],
  templateUrl: './item-search.component.html',
  styleUrl: './item-search.component.scss'
})
export class ItemSearchComponent implements OnInit {
  private readonly itemService = inject(ItemService);

  public readonly statusList: status[] = [1, 2, 3, 4, 5];
  
  public search = model.required<Search>();
  public searchForm = new FormGroup<SearchControls>({
    search: new FormControl("", { nonNullable: true }),
    status: new FormControl(-1, { nonNullable: true }),
  });

  ngOnInit(): void {
    // Sincronizamos el formulario con el valor actual del signal
    this.searchForm.patchValue(this.search(), { emitEvent: false });
    // Cada vez que el formulario cambie, actualizamos el signal
    this.searchForm.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
      )
      .subscribe(() => {
        this.search.set(this.searchForm.getRawValue());
      });
  }


  public get success(): number {
    return this.itemService.total;
  }

  public get percentage(): number {
    return this.itemService.percentage;
  }

  public setStatus(status: status): void {
    const statusForm = this.searchForm.get("status");
    if (status === 0 || statusForm === null) return;
    if (statusForm.value == status) return this.searchForm.patchValue({ status: -1 });
    this.searchForm.patchValue({ status });
  }

  public get activeStatus() {
    return this.searchForm.get('status')?.value ?? -1;
  }
}
