import { animate, style, transition, trigger } from '@angular/animations';
import { Component, computed, effect, ElementRef, HostListener, inject, model, signal, viewChild } from '@angular/core';
import { ConfirmService, ToastService, UserService } from '@core/services';
import { environment } from '@environment';
import { ItemModel } from '@home/models';
import { ItemService } from '@home/services';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ThemeDirective } from '@shared/directives';
import { ImageEditorComponent } from '../image-editor/image-editor.component';

@Component({
  selector: 'app-modal-image-item',
  imports: [ImageEditorComponent],
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
  ],
  hostDirectives: [ThemeDirective],
})
export class ModalImageItemComponent {
  readonly dimensions = signal({ width: 708, height: 500 });
  private resizeObserver = new ResizeObserver((entries) => {
    if (!entries.length) return;
    const { width, height } = entries.at(0)!.contentRect;
    this.dimensions.set({ width, height });
  });
  private readonly content = viewChild.required<ElementRef<HTMLDivElement>>('content');
  readonly effectContent = effect(() => {
    const { nativeElement } = this.content();
    this.resizeObserver.observe(nativeElement)
  });
  private readonly itemImage = viewChild<ElementRef<HTMLImageElement>>('itemImage');
  readonly itemImageChange = effect(() => {
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
  private readonly toast = inject(ToastService);
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;
  public item = model.required<ItemModel>();
  public editionMode = signal(false);
  public loading = signal(false);
  public index = signal(0);
  public isNewImageSlot = computed(() => !this.images.includes(this.index() + 1));

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
    let query = 'mode=HIGH&';
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
            this.item().upsertStatus(this.index(), 0);
            this.toast.show("Imagen eliminada", "La imagen se ha eliminado correctamente");
          }
        })
        .add(() => this.itemService.loading = false);
    }
  }

  public toogleEdition(value: boolean): void {
    this.editionMode.set(value);
  }

  readonly editor = viewChild(ImageEditorComponent);

  async onUpdate(): Promise<void> {
    const editor = this.editor();
    if (!editor) return;
    this.loading.set(true);
    try {
      const blob = await editor.export();
      if (!blob) return;
      const fd = new FormData();
      const { _id, code } = this.item();
      const index = this.index();
      fd.append('file', blob, `${code}-${index}.jpg`);
      this.itemService.uploadImage(_id, index, fd).subscribe({
        next: () => {
          this.item().upsertStatus(index, 5);
        }
      });
    } catch {
      
    } finally {
      this.loading.set(false);
    }
  }

  async onLoad(): Promise<void> {
    const editor = this.editor();
    if (!editor) return;
    this.loading.set(true);
    try {
      const blob = await editor.export();
      if (!blob) return;
      const fd = new FormData();
      const { _id, code } = this.item();
      const index = this.index();
      fd.append('image', blob, `${code} ${index}.jpg`);
      this.itemService.uploadImage(_id, index, fd).subscribe({
        next: () => {
          this.item.update((val) => {
            val.upsertStatus(index, 5);
            return val;
          })
          this.toast.show("Imagen cargada", "La imagen se ha cargado correctamente");
          this.activeModal.close(this.item());
        }, 
        error: () => {
          this.toast.show("Error de carga", "No se ha podido cargar la imagen", "danger");
        }
      });
    } catch {
      
    } finally {
      this.loading.set(false);
    }
  }
}
