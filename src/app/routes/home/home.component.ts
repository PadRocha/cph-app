import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { Search, status } from './models';
import { ItemService } from './services';
import { ItemListComponent } from './components';
import { ItemSearchComponent } from './components/item-search/item-search.component';
import { distinctUntilChanged } from 'rxjs';

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

  public isLoading = signal(false);
  public searchState = signal(initialSearch);

  public searchChange = effect(() => {
    const { search, status } = this.searchState();
    this.router.navigate(
      ['/home'],
      { queryParams: { search, status }, queryParamsHandling: 'merge', replaceUrl: true }
    );
    this.loadData();
  });

  ngOnInit(): void {
    this.syncFormWithQueryParams();
    this.syncFormWithParamMap();
  }                                                                                                                                                                             

  private syncFormWithQueryParams(): void {
    const paramMap = this.route.snapshot.queryParamMap;
    const search = paramMap.get('search') || '';
    const status = paramMap.has('status') ? Number(paramMap.get('status')) as status : -1;
    this.searchState.set({ search, status });
  }

  private syncFormWithParamMap(): void {
    this.route.queryParamMap
      .pipe(
        distinctUntilChanged((prev, curr) => {
          // 1. Compara longitud de llaves
          if (prev.keys.length !== curr.keys.length) return false;
          // 2. Crea un arreglo [clave, valor] de cada uno
          const prevEntries = prev.keys.map(k => [k, prev.get(k)]);
          const currEntries = curr.keys.map(k => [k, curr.get(k)]);
          // 3. Compara arreglos mediante JSON.stringify (o con un ciclo si prefieres)
          return JSON.stringify(prevEntries) === JSON.stringify(currEntries);
        })
      )
      .subscribe(paramMap => {
        const search = paramMap.get('search') || '';
        const status = paramMap.has('status') ? Number(paramMap.get('status')) as status : -1;
        this.searchState.set({ search, status });
        this.loadData();
      });
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.itemService.getData(this.searchState())
      .subscribe({
        next: () => {/* El ItemService actualiza internamente su estado */ },
        error: () => { /* Manejo de error si fuera necesario */ }
      })
      .add(() => this.isLoading.set(false));
  }

  private loadMore(): void {
    this.isLoading.set(true);
    this.itemService.more
      .subscribe({
        next: () => { /* Los nuevos ítems se agregan en el servicio */ },
        error: () => { /* Manejo de error si fuera necesario */ }
      })
      .add(() => this.isLoading.set(false));
  }
}
