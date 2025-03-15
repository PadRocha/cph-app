import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { environment } from '@environment';
import { ItemModel } from '@home/models';
import { status } from '@home/models';
import { ItemService } from '@home/services';

interface StatusControl {
  images: FormArray<FormControl<number>>
}

@Component({
  selector: 'app-item',
  imports: [ReactiveFormsModule],
  templateUrl: './item.component.html',
  styleUrl: './item.component.scss'
})
export class ItemComponent implements OnInit, AfterViewInit {
  private url: string;
  private location: string;
  public statusForm: FormGroup<StatusControl>;
  public options: status[]
  @Input() item!: ItemModel;
  @ViewChild('lazyImage') lazyImage!: ElementRef<HTMLImageElement>;

  constructor() {
    this.url = environment.httpUrl;
    this.location = environment.location;
    this.options = [0, 1, 2, 3, 4, 5];
    this.statusForm = new FormGroup({
      images: new FormArray(
        Array.from({ length: 3 }, () => new FormControl(-1, { nonNullable: true }))
      )
    });
  }

  ngAfterViewInit(): void {
    if (this.noImages) {
      return;
    }
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (isIntersecting) {
          const img = target as HTMLImageElement;
          img.src = this.src;
          img.srcset = this.srcset;
          observer.unobserve(target);
        }
      });
    }, {
      rootMargin: '50px'
    });

    observer.observe(this.lazyImage.nativeElement);
  }

  ngOnInit(): void {
    const formArray = this.forms;
    const images = formArray.getRawValue();

    this.item.images.forEach(({ idN, status }) => {
      const index = idN - 1;
      if (index >= 0 && index < images.length) {
        images[index] = status;
        if (status === 5) {
          formArray.at(index).disable();
        } else {
          formArray.at(index).enable();
        }
      }
    });

    this.statusForm.patchValue({ images });
  }

  public get noImages(): boolean {
    return !this.item.hasImages;
  }

  public get forms() {
    return this.statusForm.get('images') as FormArray<FormControl<number>>;
  }

  public get src(): string {
    const file = this.item.images.at(0)!;
    const image = encodeURIComponent(`${this.item.code} ${file.idN}`);
    let query = 'height=160&quality=50&';
    if (this.location) {
      query += `location=${encodeURIComponent(this.location)}`;
    }

    return `${this.url}/image/${image}?${query}`;
  }

  public get srcset(): string {
    const file = this.item.images.at(0)!;
    const image = encodeURIComponent(`${this.item.code} ${file.idN}`);
    let query = 'quality=50&';

    if (this.location) {
      query += `location=${encodeURIComponent(this.location)}&`;
    }

    const srcset = [320, 281, 247, 230, 226]
      .map(width => `${this.url}/image/${image}?${query}width=${width} ${width}w`)
      .join(', ');

    return srcset;
  }

  public selectClass(index: number) {
    const status = this.forms.at(index).value;
    return `value-${status}`
  }

  public statusChar(value: status): string {
    switch (value) {
      case 0:
        return "❌";
      case 1:
        return "✅";
      case 2:
        return "📸";
      case 3:
        return "🛠";
      case 4:
        return "✏️";
      case 5:
        return "💾";
      default:
        return "❓";
    }
  }
}
