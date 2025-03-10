import { DecimalPipe } from '@angular/common';
import { Component, OnInit, signal, WritableSignal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { ThemeDirective } from '@shared/directives';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { StatusButtonDirective } from './directives';
import { ItemModel, status } from './models';
import { ItemService } from './services';

export interface Search {
  search: FormControl<string>;
  status: FormControl<status>;
}

@Component({
  selector: 'app-home',
  imports: [DecimalPipe, ReactiveFormsModule, NgbTooltipModule, ThemeDirective, StatusButtonDirective],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  host: {
    class: 'd-block container'
  }
})
export class HomeComponent implements OnInit {
  public searchForm: FormGroup<Search>;
  public statusList: status[];
  public isLoading: WritableSignal<boolean>;

  constructor( private itemService: ItemService, private router: Router, private route: ActivatedRoute) {
    this.searchForm = new FormGroup<Search>({
      search: new FormControl("", { nonNullable: true }),
      status: new FormControl(-1, { nonNullable: true }),
    });
    this.statusList = [1, 2, 3, 4, 5];
    this.isLoading = signal(false);
  }

  ngOnInit(): void {
    // 1. Sincroniza el formulario con los queryParams al inicio.
    this.syncFormWithQueryParams();
    // 2. Suscribirse a cambios del formulario para actualizar los queryParams
    this.searchForm.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
      )
      .subscribe(() => {
        if (this.searchForm.valid) {
          const { search, status } = this.searchForm.getRawValue();
          // Actualiza la ruta con los nuevos parámetros
          // "merge" => combina con params existentes, "replaceUrl" => no empuja un nuevo estado al historial
          this.router.navigate(
            ['/home'],
            { queryParams: { search, status }, queryParamsHandling: 'merge', replaceUrl: true }
          );
        }
      });
    // 3. Escucha cambios en la ruta (queryParamMap) para recargar datos cada vez que haya cambios
    //    Esto incluye cuando el usuario va “atrás” o “adelante” usando el NavigationService
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
        this.searchForm.patchValue({ search, status }, { emitEvent: false });
        this.loadData();
      });
  }

  private syncFormWithQueryParams(): void {
    const paramMap = this.route.snapshot.queryParamMap;
    const search = paramMap.get('search') || '';
    const status = paramMap.has('status') ? Number(paramMap.get('status')) as status : -1;
    this.searchForm.patchValue({ search, status }, { emitEvent: false });
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.itemService.getData(this.searchForm.getRawValue())
      .subscribe({
        next: (data) => {
          // console.log(data);

          // console.log(this.itemArray);
          /* El ItemService actualiza internamente su estado */
        },
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

  public get itemArray(): ItemModel[] {
    return this.itemService.all;
  }

  public get success(): number {
    return this.itemService.total;
  }

  public get percentage(): number {
    return this.itemService.percentage;
  }

  public get notFound(): boolean {
    return !this.isLoading() && this.itemService.noItems;
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
