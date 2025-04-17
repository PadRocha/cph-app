import { AfterViewInit, Directive, ElementRef, HostBinding, HostListener, inject, output } from '@angular/core';

enum DropColor {
  BEFORE_DROP = '#80808017',
  DURING_DROP = '#8080807d',
  AFTER_DROP = '#80808017'
}

@Directive({
  selector: '[app-drop]'
})
export class DropImageDirective implements AfterViewInit {
  private readonly ref = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostBinding('style.background-color') 
  hostBackgroundColor = DropColor.BEFORE_DROP;
  @HostBinding('class.active')
  isActive = false;

  dropFile = output<{ file: File, url: string }>();

  private hostElementRect: DOMRect | undefined;

  ngAfterViewInit(): void {
    this.updateHostRect();
    console.log('ngAfterViewInit - Host Element:', this.ref.nativeElement);

    // Listener global para confirmar que se capturan eventos a nivel de documento
    document.addEventListener('dragenter', (e) => console.log('Global dragenter:', e));
    document.addEventListener('dragover', (e) => console.log('Global dragover:', e));
    document.addEventListener('dragleave', (e) => console.log('Global dragleave:', e));
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      console.log('Global drop:', e);
    });
  }

  private updateHostRect(): void {
    this.hostElementRect = this.ref.nativeElement.getBoundingClientRect();
    console.log('updateHostRect - Rect:', this.hostElementRect);
  }

  @HostListener('dragenter', ['$event'])
  dragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    console.log('dragEnter en overlay:', event);
    this.isActive = true;
    this.hostBackgroundColor = DropColor.DURING_DROP;
  }

  @HostListener('dragover', ['$event'])
  dragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    console.log('dragOver en overlay:', event);
    this.hostBackgroundColor = DropColor.DURING_DROP;
  }

  @HostListener('dragleave', ['$event'])
  dragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    console.log('dragLeave en overlay:', event);
    this.updateHostRect();
    if (this.hostElementRect &&
      (event.clientX < this.hostElementRect.left ||
        event.clientX > this.hostElementRect.right ||
        event.clientY < this.hostElementRect.top ||
        event.clientY > this.hostElementRect.bottom)) {
      console.log('dragLeave - Fuera de límites del overlay.');
      this.isActive = false;
      this.hostBackgroundColor = DropColor.BEFORE_DROP;
    } else {
      console.log('dragLeave - Dentro de límites, ignorando.');
    }
  }

  @HostListener('drop', ['$event'])
  drop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    console.log('drop en overlay:', event);
    this.isActive = false;
    this.hostBackgroundColor = DropColor.AFTER_DROP;
    const fileList = event.dataTransfer?.files;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      const url = URL.createObjectURL(file);
      console.log('drop - Archivo recibido:', file, 'URL:', url);
      this.dropFile.emit({ file, url });
    } else {
      console.log('drop - No se encontraron archivos.');
    }
  }
}