import { trigger, transition, style, animate } from '@angular/animations';
import { AfterViewInit, Component, ElementRef, HostListener, inject, input, OnInit, signal, ViewChild } from '@angular/core';
import { environment } from '@environment';
import { ItemModel } from '@home/models';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-modal-image-item',
  imports: [],
  templateUrl: './modal-image-item.component.html',
  styleUrl: './modal-image-item.component.scss',
  animations: [
    trigger('slideAnimation', [
      transition(':increment', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':decrement', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ])
  ]
})
export class ModalImageItemComponent implements AfterViewInit {
  @ViewChild('itemImage') itemImage!: ElementRef<HTMLImageElement>;
  
  private readonly activeModal = inject(NgbActiveModal);
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;
  public item = input.required<ItemModel>();
  public editionMode = signal(false);
  public loading = signal(false);
  public index = signal(0);

  ngAfterViewInit(): void {
    this.loadImages();
  }

  @HostListener('window:keydown.arrowleft', ['$event'])
  public prevImage(event: Event): void {
    if (event instanceof MouseEvent) {
      const button = event.target as HTMLButtonElement;
      button.blur();
    } else event.preventDefault();

    if (this.index() > 0) {
      this.index.update(value => value - 1);
      this.loadImages();
    }
  }

  @HostListener('window:keydown.arrowright', ['$event'])
  public nextImage(event: Event): void {
    if (event instanceof MouseEvent) {
      const button = event.target as HTMLButtonElement;
      button.blur();
    } else event.preventDefault();

    if (this.index() < this.images.length - 1) {
      this.index.update(value => value + 1);
      this.loadImages();
    }
  }

  private buildImageUrl(queryParams: string): string {
    const { key, code, images: itemImages } = this.item();
    const firstImage = itemImages.at(this.index())!;
    const imageId = encodeURIComponent(`${code} ${firstImage.idN}`);
    return `${this.url}/image/${key}/${imageId}?${queryParams}`;
  }

  public get placeholder(): string {
    let query = 'mode=PLACEHOLDER&';
    if (this.location) {
      query += `location=${encodeURIComponent(this.location)}`;
    }
    return this.buildImageUrl(query);
  }

  public get src(): string {
    let query = 'mode=HIGH&';
    if (this.location) query += `location=${encodeURIComponent(this.location)}`;
    return this.buildImageUrl(query);
  }

  public get srcset(): string {
    let query = 'mode=HIGH&';
    if (this.location) {
      query += `location=${encodeURIComponent(this.location)}&`;
    }
    const widths = [708, 466];
    return widths
      .map(w => `${this.buildImageUrl(query + 'width=' + w)} ${w}w`)
      .join(', ');
  }

  private loadImages(): void {
    const nativeImg = this.itemImage.nativeElement;

    nativeImg.src = this.placeholder;
    nativeImg.srcset = '';

    const finalImg = new Image();
    finalImg.src = this.src;
    finalImg.srcset = this.srcset;

    finalImg.onload = () => {
      nativeImg.src = finalImg.src;
      nativeImg.srcset = finalImg.srcset;
    };

    finalImg.onerror = () => {
      console.error('Error al cargar la imagen final');
    };
  }

  public get code(): string {
    return this.loading() ? 'Cargando...' : this.item().code;
  }

  public get hasPrev(): boolean {
    return this.index() > 0 && !this.loading() && !this.editionMode();
  }

  public get hasNext(): boolean {
    return this.index() < (this.item().total - 1) && !this.loading() && !this.editionMode();
  }

  public get images() {
    return this.item().allIDN;
  }

  private get idN() {
    return this.images.at(this.index());
  }

  public goToImage(index_value: number): void {
    if (index_value !== this.index()) {
      this.index.set(index_value);
      this.loadImages();
    }
  }

  public close(reason?: string): void {
    if (reason) {
      this.activeModal.dismiss(reason)
    } else {
      this.activeModal.close();
    }
  }

  public toogleEdition(): void {
    this.editionMode.set(!this.editionMode());
  }
}
