import { HttpClient, HttpParams } from '@angular/common/http';
import { Directive, effect, ElementRef, inject, input, OnDestroy, Renderer2 } from '@angular/core';
import { environment } from '@environment';
import { Item } from '@pdf/models';

@Directive({
  selector: '[lazy-img]'
})
export class LazyImgDirective implements OnDestroy {
  private readonly ref = inject<ElementRef<HTMLImageElement>>(ElementRef);
  private readonly http = inject(HttpClient);
  private readonly render = inject(Renderer2);
  public readonly item = input.required<Item>();
  private readonly location = environment.location;
  private readonly url = environment.httpUrl;
  private placeholderURL: string | null = null;

  private observer = new IntersectionObserver((entries, observer) => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      const img = target as HTMLImageElement;
      const { code ,images } = this.item();
      const key = code.slice(0, 6);
      const idN = this.pickIdn(images);
      if (!idN) {
        img.src = 'no_avaliable.png';
        img.removeAttribute('srcset');
        observer.unobserve(target);
        return;
      } else {
        img.srcset = this.buildSrcset(key, code, idN);
      }
      observer.unobserve(target);
    }
  }, { rootMargin: '50px' });

  private readonly _ = effect(() => {
    const { code, images } = this.item();
    const idN = this.pickIdn(images);
    if (idN) {
      const file = `${code} ${idN}`;
      const key = code.slice(0, 6);
      const params = new HttpParams({
        fromObject: this.location
          ? { mode: 'PLACEHOLDER', location: this.location }
          : { mode: 'PLACEHOLDER' },
      });
      this.http.get(`${this.url}/image/${key}/${file}`, { params, responseType: 'blob' })
        .subscribe({
          next: (blob) => {
            this.clearObjectUrl();
            this.placeholderURL = URL.createObjectURL(blob);
            this.render.setAttribute(this.ref.nativeElement, 'src', this.placeholderURL);
          },
          error: err => {
            console.error('Error al cargar el placeholder:', err);
            this.render.setAttribute(this.ref.nativeElement, 'src', 'default.png');
          }
        })
        .add(() => this.observer.observe(this.ref.nativeElement));
    } else {
      this.render.removeAttribute(this.ref.nativeElement, 'srcset');
      this.render.setAttribute(this.ref.nativeElement, 'src', 'no_avaliable.png');
    }
  });

  private pickIdn(images: Item['images']): number | undefined {
    const idN = images.filter(({ status }) => status === 5)
      .map(({ idN }) => idN)
      .sort()
      .at(0);
    return idN;
  }

  private clearObjectUrl(): void {
    if (this.placeholderURL) {
      URL.revokeObjectURL(this.placeholderURL);
      this.placeholderURL = null;
    }
  }

  private buildSrcset(key: string, code: string, idn: number): string {
    const widths = [640, 480, 360, 320, 240];
    const loc = this.location ? `location=${encodeURIComponent(this.location)}&` : '';
    const q = `quality=50&${loc}`;
    const image_id = encodeURIComponent(`${code} ${idn}`);
    return widths
      .map((w) => `${this.url}/image/${key}/${image_id}?${q}width=${w} ${w}w`)
      .join(', ');
  }

  ngOnDestroy(): void {
    this.clearObjectUrl();
    this.observer.disconnect();
  }

}
