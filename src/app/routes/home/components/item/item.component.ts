import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, inject, input, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { environment } from '@environment';
import { ItemModel, status } from '@home/models';
import { ThemeDirective } from '@shared/directives';
import { trigger, transition, style, animate } from '@angular/animations';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ModalImageItemComponent } from '../modal-image-item/modal-image-item.component';

interface StatusControl {
  images: FormArray<FormControl<number>>
}

@Component({
  selector: 'app-item',
  imports: [ReactiveFormsModule, ThemeDirective],
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
  host: { '[@fadeSlide]': '' }
})
export class ItemComponent implements OnInit, AfterViewInit {
  @ViewChild('lazyImage') lazyImage!: ElementRef<HTMLImageElement>;

  private readonly http = inject(HttpClient);
  private readonly modal = inject(NgbModal);
  public readonly item = input.required<ItemModel>();
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;
  public readonly options: status[] = [0, 1, 2, 3, 4, 5];

  public statusForm = new FormGroup<StatusControl>({
    images: new FormArray(
      Array.from({ length: 3 }, () => new FormControl(-1, { nonNullable: true }))
    )
  });

  ngOnInit(): void {
    const images = this.statusForm.get('images') as FormArray<FormControl<number>>;
    const itemData = this.item();
    const imageStatuses = images.getRawValue();

    itemData.images.forEach(({ idN, status }) => {
      const index = idN - 1;
      if (index >= 0 && index < imageStatuses.length) {
        imageStatuses[index] = status;
        images.at(index)[status === 5 ? 'disable' : 'enable']();
      }
    });
    this.statusForm.patchValue({ images: imageStatuses });
  }

  ngAfterViewInit(): void {
    if (this.noImages) return;
    this.loadPlaceholder();
    this.observeLazyImage();
  }

  private loadPlaceholder(): void {
    const params: {
      mode: string;
      location?: string;
    } = {
      mode: "PLACEHOLDER"
    }
    if (this.location) params.location = this.location;
    const { key, code, images: itemImages } = this.item();
    const firstImage = itemImages.at(0)!;
    const imageId = `${code} ${firstImage.idN}`;
    this.http.get(`${this.url}/image/${key}/${imageId}`, { params, responseType: 'blob' })
      .subscribe({
        next: (blob) => this.lazyImage.nativeElement.src = URL.createObjectURL(blob),
        error: err => console.error('Error al cargar el placeholder:', err)
      });
  }

  private observeLazyImage(): void {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (isIntersecting) {
          const img = target as HTMLImageElement;
          img.src = this.src;
          img.srcset = this.srcset;
          observer.unobserve(target);
        }
      });
    }, { rootMargin: '50px' });
    observer.observe(this.lazyImage.nativeElement);
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

  public get forms(): FormArray<FormControl<number>> {
    return this.statusForm.get('images') as FormArray<FormControl<number>>;
  }

  private buildImageUrl(queryParams: string): string {
    const { key, code, images: itemImages } = this.item();
    const firstImage = itemImages.at(0)!;
    const imageId = encodeURIComponent(`${code} ${firstImage.idN}`);
    return `${this.url}/image/${key}/${imageId}?${queryParams}`;
  }

  public get src(): string {
    let query = 'height=160&quality=50&';
    if (this.location) query += `location=${encodeURIComponent(this.location)}`;
    return this.buildImageUrl(query);
  }

  public get srcset(): string {
    let query = 'quality=50&';
    if (this.location) query += `location=${encodeURIComponent(this.location)}&`;
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

  public open() {
    const modalRef = this.modal.open(ModalImageItemComponent, { size: "lg", animation: true, centered: true });
    const instancia = modalRef.componentInstance as ModalImageItemComponent;
    instancia.item = this.item;
  }
}
