import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbOffcanvas, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { distinctUntilChanged } from 'rxjs';
import { AsideKeysComponent, ItemListComponent, ItemSearchComponent } from './components';
import { Search, status } from './models';
import { ItemService } from './services';

const initialSearch: Search = {
  search: '',
  status: -1,
};

@Component({
  selector: 'app-home',
  imports: [
    NgbTooltipModule,
    ItemListComponent,
    ItemSearchComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  host: {
    class: 'd-block container pb-3'
  },
})
export class HomeComponent implements OnInit {
  private readonly itemService = inject(ItemService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly offcanvas = inject(NgbOffcanvas);

  private readonly _searchChange = effect(() => {
    const { search, status } = this.itemService.searchParams;
    this.router.navigate(
      ['/home'],
      { queryParams: { search, status }, queryParamsHandling: 'merge', replaceUrl: true }
    );
  });

  ngOnInit(): void {
    this.syncFormWithQueryParams();
    this.syncFormWithParamMap();
  }

  private syncFormWithQueryParams(): void {
    const paramMap = this.route.snapshot.queryParamMap;
    const search = paramMap.get('search') || '';
    const status = paramMap.has('status') ? Number(paramMap.get('status')) as status : -1;
    this.itemService.searchParams = { search, status };
  }

  private syncFormWithParamMap(): void {
    this.route.queryParamMap
      .pipe(
        distinctUntilChanged((prev, curr) => {
          if (prev.keys.length !== curr.keys.length) return false;
          const prevEntries = prev.keys.map(k => [k, prev.get(k)]);
          const currEntries = curr.keys.map(k => [k, curr.get(k)]);
          return JSON.stringify(prevEntries) === JSON.stringify(currEntries);
        })
      )
      .subscribe(paramMap => {
        const search = paramMap.get('search') || '';
        const status = paramMap.has('status') ? Number(paramMap.get('status')) as status : -1;
        this.itemService.searchParams = { search, status };
        this.loadData();
      });
  }

  private loadData(): void {
    this.itemService.loading = true;
    this.itemService.getData()
      .subscribe({
        next: () => {/* El ItemService actualiza internamente su estado */ },
        error: () => { /* Manejo de error si fuera necesario */ }
      })
      .add(() => this.itemService.loading = false);
  }

  @HostListener("window:keydown.control.k", ["$event"])
  openKeys(event: Event): void {
    if (!event?.preventDefault) return;
    event.preventDefault();
    if (this.offcanvas.hasOpenOffcanvas()) return this.offcanvas.dismiss();
    const offcanvas = this.offcanvas.open(AsideKeysComponent, {
      position: "end",
      panelClass: "text-bg-dark aside-width",
    });
    offcanvas.closed.subscribe({
      next: ({ value }: { value: string }) => {
        const curr = this.itemService.searchParams;
        this.itemService.searchParams = { ...curr, search: value };
      },
    });
  }
}
