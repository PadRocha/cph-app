import { Component, computed, inject, model, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '@environment';
import { ItemModel, status } from '@home/models';
import { ItemService } from '@home/services';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ThemeDirective } from '@shared/directives';

interface ItemForm {
  readonly key: string;
  readonly code: string;
  readonly desc: string;
}

@Component({
  selector: 'app-modal-item',
  imports: [ReactiveFormsModule],
  templateUrl: './modal-item.component.html',
  styleUrl: './modal-item.component.scss',
  hostDirectives: [ThemeDirective],
})
export class ModalItemComponent {
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;
  private readonly itemService = inject(ItemService);
  private readonly activeModal = inject(NgbActiveModal);
  public readonly item = model.required<ItemModel>();
  public readonly itemRef = computed(() => this.item().raw);
  public size = 0;
  public readonly options: status[] = [0, 1, 2, 3, 4];
  public readonly itemForm: FormGroup<{ [K in keyof ItemForm]: FormControl<ItemForm[K]>; }> = new FormGroup({
    key: new FormControl('', {
      validators: [Validators.required, Validators.minLength(6), Validators.maxLength(6)],
      nonNullable: true
    }),
    code: new FormControl('', {
      validators: [Validators.required, Validators.minLength(4), Validators.maxLength(4)],
      nonNullable: true
    }),
    desc: new FormControl('', { validators: Validators.required, nonNullable: true }),
  });
  public readonly statusForm = new FormControl('', { validators: Validators.required, nonNullable: true });
  public readonly reference = viewChild.required<HTMLDivElement>('reference');

  public close(reason?: string): void {
    if (reason) {
      this.activeModal.dismiss(reason)
    } else {
      this.activeModal.close();
    }
  }

  public onSubmit(): void {

  }

  public onDelete(): void {

  }

  public onReset(): void {

  }

  public get hasImages(): boolean {
    return this.item().hasImages;
  }

  public get images(): number[] {
    return this.item().allIDN;
  }

  public src(index: number): string {
    const { key, code, images: itemImages } = this.item();
    const image = itemImages.at(index - 1)!;
    let query = 'mode=LOW&';
    if (this.location) query += `location=${encodeURIComponent(this.location)}&`;
    const imageId = encodeURIComponent(`${code} ${image.idN}`);
    return `${this.url}/image/${key}/${imageId}?${query}width=100`;
  }

  public notReseted(status: status): boolean {
    return !this.item().isReseted(status);
  }

  public selectClass(): string {
    return `value-${this.statusForm.value}`;
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
}
