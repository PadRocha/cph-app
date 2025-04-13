import { trigger, transition, style, animate } from '@angular/animations';
import { Component, effect, ElementRef, HostListener, inject, model, signal, viewChild } from '@angular/core';
import { ConfirmService, UserService } from '@core/services';
import { environment } from '@environment';
import { ItemModel } from '@home/models';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ThemeDirective } from '@shared/directives';
import { ImageEditorComponent } from '../image-editor/image-editor.component';
import { ItemService } from '@home/services';

@Component({
  selector: 'app-modal-image-item',
  imports: [ThemeDirective, ImageEditorComponent],
  templateUrl: './modal-image-item.component.html',
  styleUrls: ['./modal-image-item.component.scss'],
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
export class ModalImageItemComponent {
  private readonly itemImage = viewChild<ElementRef<HTMLImageElement>>('itemImage');
  readonly itemImageChange = effect(()=> {
    const ref = this.itemImage();
    if (ref) {
      const nativeImg = ref.nativeElement;
      nativeImg.src = this.placeholder;
      nativeImg.srcset = '';

      const finalImg = new Image();
      finalImg.srcset = this.srcset();
      finalImg.addEventListener('load', () => nativeImg.srcset = finalImg.srcset);
      finalImg.addEventListener('error', () => {
        console.error('Error al cargar la imagen final');
      });
    }
  });
  
  private readonly activeModal = inject(NgbActiveModal);
  private readonly user = inject(UserService);
  private readonly confirm = inject(ConfirmService);
  private readonly itemService = inject(ItemService);
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;
  public item = model.required<ItemModel>();
  public editionMode = signal(false);
  public loading = signal(false);
  public index = signal(0);

  @HostListener('window:keydown.arrowleft', ['$event'])
  public prevImage(event: Event): void {
    if (event instanceof MouseEvent) {
      const button = event.target as HTMLButtonElement;
      button.blur();
    } else event.preventDefault();

    if (this.index() > 0) {
      this.index.update(value => value - 1);
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

  public srcset(force: boolean = false): string {
    let query = 'quality=50&';
    if (this.location) query += `location=${encodeURIComponent(this.location)}&`;
    if (force) query += 'v=1&';
    const widths = [708, 466];
    return widths
      .map(width => `${this.buildImageUrl(`${query}width=${width}`)} ${width}w`)
      .join(', ');
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

  public goToImage(index_value: number): void {
    if (index_value !== this.index()) {
      this.index.set(index_value);
    }
  }

  public get hasAuth() {
    return this.user.hasRole('READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN');
  }

  public close(reason?: string): void {
    if (reason) {
      this.activeModal.dismiss(reason)
    } else {
      this.activeModal.close();
    }
  }

  async onRemove(): Promise<void> {
    const allowed = await this.confirm.ask({
      intent: 'eliminar',
      subject: 'imagen',
      token: `${this.item().code} ${this.index() + 1}`
    });
    if (allowed) {
      this.itemService.loading = true;
      this.itemService
      .deleteImage(this.item()._id, this.index() + 1)
      .subscribe({
        next: () => {
          //
        }
      })
      .add(()=> this.itemService.loading = false);
    }
  }

  public toogleEdition(): void {
    this.editionMode.set(!this.editionMode());
  }
}
