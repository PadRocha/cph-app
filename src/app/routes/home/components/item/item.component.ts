import { animate, style, transition, trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, ElementRef, inject, model, OnDestroy, OnInit, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '@core/services/toast/toast.service';
import { environment } from '@environment';
import { ModalImageItemComponent, ModalItemComponent } from '@home/components';
import { ItemModel, status } from '@home/models';
import { ItemService } from '@home/services';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { debounceTime, filter, map, Observable, pairwise } from 'rxjs';

interface StatusControl {
  images: FormArray<FormControl<number>>
}

interface StatusChange {
  index: number;
  status: status;
  prev: number;
}

@Component({
  selector: 'item',
  imports: [ReactiveFormsModule],
  templateUrl: './item.component.html',
  styleUrl: './item.component.scss',
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('400ms ease-in', style({ opacity: 0, transform: 'translateY(20px)' }))
      ])
    ])
  ],
  host: { '[@fadeSlide]': '' },
})
export class ItemComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly modal = inject(NgbModal);
  private readonly itemService = inject(ItemService);
  private readonly toast = inject(ToastService);
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;
  public readonly options: status[] = [0, 1, 2, 3, 4, 5];
  private readonly modalOptions: NgbModalOptions = {
    size: "lg",
    keyboard: false,
    animation: true,
    centered: true,
    backdropClass: "blurred-backdrop",
  };

  private readonly lazyImage = viewChild.required<ElementRef<HTMLImageElement>>('lazyImage');
  public readonly item = model.required<ItemModel>();

  public readonly statusForm = new FormGroup<StatusControl>({
    images: new FormArray(
      Array.from({ length: 3 }, () => new FormControl(-1, { nonNullable: true }))
    )
  });
  public get forms(): FormArray<FormControl<number>> {
    return this.statusForm.get('images') as FormArray<FormControl<number>>;
  }
  private onStatusChange(filtro: (prev: number, curr: number) => boolean): Observable<StatusChange[]> {
    return this.forms.valueChanges.pipe(
      debounceTime(500),
      map(() => this.statusForm.getRawValue().images),
      pairwise(),
      map(([prev, curr]) =>
        curr.map((value, index) => {
          const status = Number(value) as status;
          const prevStatus = Number(prev[index]) as status;
          return { index, status, prev: prevStatus };
        }).filter(({ prev, status }) => prev !== 5 && filtro(prev, status))
      ),
      filter(array => array.length > 0)
    );
  }
  private eventSave = toSignal(this.onStatusChange((_, curr) => curr === 5));
  readonly effectSave = effect(async () => {
    const saved = this.eventSave();
    if (!saved?.length) return;
    const { index, status, prev } = saved.at(0)!;
    const control = this.forms.at(index);
    control.disable({ emitEvent: false });

    const modalRef = this.modal.open(ModalImageItemComponent, this.modalOptions);
    const instance = modalRef.componentInstance as ModalImageItemComponent;
    instance.item = this.item;
    instance.index.set(index);
    instance.editionMode.set(true);

    try {
      await modalRef.result;
    } catch {
      control.setValue(prev);
    } finally {
      control.enable({ emitEvent: false });
    }
  });
  private eventStatus = toSignal(this.onStatusChange((prev, curr) => curr !== 5 && curr !== prev));
  readonly effectStatus = effect(() => {
    const form = this.eventStatus();
    if (form && form.length > 0) {
      const { index, status, prev } = form.at(0)!;
      const image = this.forms.at(index);
      const { _id } = this.item();
      image.disable({ emitEvent: false });

      this.itemService
        .updateStatus(_id, index + 1, status)
        .subscribe({
          next: () => {
            this.toast.show('Estado actualizado', 'El estado de la imagen ha sido actualizado.', 'success');
          },
          error: () => {
            image.setValue(prev, { emitEvent: false });
            this.toast.show('Error al actualizar el estado', 'No se pudo actualizar el estado de la imagen.', 'danger');
          }
        })
        .add(() => image.enable({ emitEvent: false }));
    }
  });

  private placeholderURL: string | null = null;
  private lazyObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (isIntersecting) {
        const img = target as HTMLImageElement;
        img.srcset = this.srcset();
        observer.unobserve(target);
      }
    });
  }, { rootMargin: '50px' });

  // Hooks del ciclo de vida
  ngOnInit(): void {
    const images = this.forms;
    const itemData = this.item();
    const imageStatuses = images.getRawValue();

    itemData.images.forEach(({ idN, status }) => {
      const index = idN - 1;
      if (index >= 0 && index < imageStatuses.length) {
        imageStatuses[index] = status;
        if (status === 5) images.at(index).disable({ emitEvent: false });
      }
    });

    this.statusForm.patchValue({ images: imageStatuses });
    if (!this.noImages) {
      this.loadPlaceholder();
      this.lazyObserver.observe(this.lazyImage().nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.placeholderURL) {
      URL.revokeObjectURL(this.placeholderURL);
    }
    if (this.lazyObserver) {
      this.lazyObserver.disconnect();
    }
    this.modal.dismissAll();
  }

  // Getters usados en la plantilla
  public get id(): string {
    return this.item()._id;
  }

  public get code(): string {
    return this.item().code;
  }

  public get desc(): string {
    return this.item().desc;
  }

  public get noImages(): boolean {
    return !this.item().hasImages;
  }

  // Métodos públicos de uso general en la plantilla
  public srcset(force: boolean = false): string {
    let query = 'quality=50&';
    if (this.location) query += `location=${encodeURIComponent(this.location)}&`;
    if (force) query += 'v=1&';
    const widths = [320, 281, 247, 230, 226];
    return widths
      .map(width => `${this.buildImageUrl(`${query}width=${width}`)} ${width}w`)
      .join(', ');
  }

  public selectClass(index: number): string {
    return `value-${this.forms.at(index).value}`;
  }

  public statusChar(value: status): string {
    switch (value) {
      case 0: return "❌";
      case 1: return "✅";
      case 2: return "📸";
      case 3: return "🛠";
      case 4: return "✏️";
      case 5: return "💾";
      default: return "❓";
    }
  }

  public openEditModal() {
    const modalRef = this.modal.open(ModalItemComponent, this.modalOptions);
    const instancia = modalRef.componentInstance as ModalImageItemComponent;
    instancia.item = this.item;
  }

  public openImageModal(): void {
    const modalRef = this.modal.open(ModalImageItemComponent, this.modalOptions);
    const instancia = modalRef.componentInstance as ModalImageItemComponent;
    instancia.item = this.item;
    modalRef.closed.subscribe({
      next: (item: ItemModel) => {
        console.log('Hola mundo', this.noImages);
        
        const images = Array.from({ length: 3 }, (_, i) => item.getStatus(i));
        this.statusForm.patchValue({ images }, { emitEvent: false });
        if (!this.noImages) {
          const img = this.lazyImage().nativeElement;
          console.log(img);
          
          img.removeAttribute('src'); 
          img.srcset = this.srcset(true);
          console.log(img);
        }
      },
      error: () => console.log('Modal cerrado')
    });
  }

  // Métodos privados de ayuda
  private loadPlaceholder(): void {
    const params: {
      mode: string;
      location?: string;
    } = {
      mode: "PLACEHOLDER"
    };
    if (this.location) params.location = this.location;
    const { key, code, images: itemImages } = this.item();
    const firstImage = itemImages.at(0)!;
    const imageId = `${code} ${firstImage.idN}`;
    this.http.get(`${this.url}/image/${key}/${imageId}`, { params, responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          if (this.placeholderURL) URL.revokeObjectURL(this.placeholderURL);
          this.placeholderURL = URL.createObjectURL(blob);
          this.lazyImage().nativeElement.src = this.placeholderURL;
        },
        error: err => console.error('Error al cargar el placeholder:', err)
      });
  }

  private buildImageUrl(queryParams: string): string {
    const { key, code, images: itemImages } = this.item();
    const firstImage = itemImages.at(0)!;
    const imageId = encodeURIComponent(`${code} ${firstImage.idN}`);
    return `${this.url}/image/${key}/${imageId}?${queryParams}`;
  }
}
