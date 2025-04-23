import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, input, model, OnDestroy, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '@environment';
import { ItemModel } from '@home/models';
import { NgbActiveModal, NgbModal, NgbPopover, NgbPopoverModule, NgbTypeahead, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { listen, TauriEvent, UnlistenFn } from '@tauri-apps/api/event';
import { extname } from '@tauri-apps/api/path';
import { readFile } from '@tauri-apps/plugin-fs';
import { ActiveSelection, Canvas, FabricImage, FabricObject, Line, Textbox, XY } from 'fabric';
import { makeBoundingBoxFromPoints } from 'node_modules/fabric/dist/src/util';
import { debounceTime, distinctUntilChanged, filter, fromEvent, map, mergeWith, Observable, OperatorFunction, pairwise, startWith } from 'rxjs';

interface FormText {
  fontSize: number;
  fontFamily: string;
  textBackgroundColor: string;
  stroke: string;
  fill: string;
}

interface FormLine {
  strokeWidth: number;
  opacity: number;
  stroke: string;
  backgroundColor: string;
}

interface History {
  version: string;
  objects: FabricObject[];
}

const NEXT_CAP: Record<CanvasLineCap, CanvasLineCap> = {
  butt: 'round',
  round: 'square',
  square: 'butt'
};

@Component({
  selector: 'image-editor',
  imports: [ReactiveFormsModule, NgbPopoverModule, NgbTypeaheadModule, NgTemplateOutlet],
  templateUrl: './image-editor.component.html',
  styleUrl: './image-editor.component.scss'
})
export class ImageEditorComponent implements OnDestroy {
  private readonly defaultWidth = 708;
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;

  public readonly item = model.required<ItemModel>();
  public readonly index = input.required<number>();
  public readonly dimensions = input.required<{ width: number; height: number }>();

  private readonly canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly canvas = computed(() =>
    new Canvas(this.canvasElement().nativeElement, {
      backgroundColor: '#ffffff',
      fireRightClick: true,
      stopContextMenu: true,
      backgroundVpt: true,
    })
  );

  private unlistenDragDrop: UnlistenFn | null = null;
  private readonly backgroundURL = signal<string | null>(null);
  public readonly isBackgroundSet = computed(() => !!this.backgroundURL());
  public readonly bgIsTransparent = signal(true);

  readonly effectCanvas = effect(async () => {
    const canvas = this.canvas();
    canvas.skipTargetFind = true;
    canvas.selection = false;
    // Carga y configuración de background
    let url = '/init.png';
    const { key, code, allIDN } = this.item();
    const idN = this.index() + 1;
    if (allIDN.includes(idN)) {
      let queryPlaceholder = 'mode=PLACEHOLDER';
      let queryHigh = 'mode=HIGH';
      if (this.location) {
        const loc = encodeURIComponent(this.location);
        queryPlaceholder += `&location=${loc}`;
        queryHigh += `&location=${loc}`;
      }
      const image = encodeURIComponent(`${code} ${idN}`);
      const baseUrl = `${this.url}/image/${key}/${image}`;
      const placeholder = await FabricImage.fromURL(
        `${baseUrl}?${queryPlaceholder}`,
        { crossOrigin: 'anonymous' }
      );
      placeholder.scaleToWidth(this.defaultWidth);
      canvas.backgroundImage = placeholder;
      canvas.renderAll();
      url = `${baseUrl}?${queryHigh}`;
    }
    const image = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
    image.scaleToWidth(this.defaultWidth);
    image.canvas = canvas;
    canvas.backgroundImage = image;
    canvas.renderAll();
    // Configuraciones adicionales del canvas
    this.present = this.timeLine;
    canvas.skipTargetFind = false;
    canvas.selection = true;
    canvas.selectionKey = 'altKey';

    this.unlistenDragDrop = await listen<{ paths: string[] }>(TauriEvent.DRAG_DROP, async (event) => {
      if (Array.isArray(event.payload?.paths) && event.payload.paths.length > 0) {
        const [filePath] = event.payload.paths;
        const bytes = await readFile(filePath);
        const ext = await extname(filePath);
        if (!['jpg', 'jpeg', 'png'].includes(ext.toLowerCase())) return;
        const mimeTypes: { [key: string]: string } = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
        };
        const type = mimeTypes[ext.toLowerCase()] ?? 'application/octet-stream';
        const background = this.backgroundURL();
        if (background) URL.revokeObjectURL(background);
        this.backgroundURL.set(URL.createObjectURL(new Blob([bytes], { type })));
        const newImage = await FabricImage.fromURL(this.backgroundURL()!);
        newImage.scaleToWidth(this.defaultWidth);
        newImage.canvas = canvas;
        canvas.backgroundImage = newImage;
        canvas.renderAll();
      }
    });

    canvas.on({
      'object:added': () => this.historySaveAction(),
      'object:removed': () => this.historySaveAction(),
      'object:modified': () => this.historySaveAction(),
      'object:skewing': () => this.historySaveAction(),
      'contextmenu': ({ e }) => this.displayInput(e),
      'mouse:down': ({ e }) => e instanceof MouseEvent && this.startGesture(e),
      'mouse:move': ({ e }) => e instanceof MouseEvent && this.updateGesture(e),
      'mouse:up': () => {
        this.endGesture();
        const actives = canvas.getActiveObjects();
        if (actives.length) this.objectSelected(actives);
      },
      'selection:created': () => this.objectSelected(canvas.getActiveObjects()),
      'selection:updated': () => this.objectSelected(canvas.getActiveObjects()),
      'selection:cleared': () => this.selectionCleared(),
      'object:moving': () => this.followSelection(),
    });
  });

  readonly effectDimensions = effect(() => {
    const canvas = this.canvas();
    const { width, height } = this.dimensions();
    canvas.setDimensions({ width, height });
    canvas.setZoom(width <= 0 ? 1 : width / this.defaultWidth);
    canvas.renderAll();
  });

  private currentLine = signal<Line | null>(null);
  private canvasLineOn = signal(false);
  private undo: History[] = [];
  private redo: History[] = [];
  private present: History | null = null;
  private activeHistory = false;

  public menuLineOn = false;
  public menuTextOn = false;
  public menuColorOn = false;

  private bootSelection<T extends FabricObject>(actives: T[]): void {
    const canvas = this.canvas();
    canvas.discardActiveObject();
    const selection = new ActiveSelection(actives, { canvas });
    canvas.setActiveObject(selection);
  }

  public textForm: FormGroup<{ [K in keyof FormText]: FormControl<FormText[K]> }> = new FormGroup({
    fontSize: new FormControl(40, { validators: Validators.min(1), nonNullable: true }),
    fontFamily: new FormControl('Times New Roman', { nonNullable: true }),
    textBackgroundColor: new FormControl('', { nonNullable: true }),
    stroke: new FormControl('', { nonNullable: true }),
    fill: new FormControl('rgb(0,0,0)', { nonNullable: true }),
  });

  private readonly eventText = toSignal(
    this.textForm.valueChanges.pipe(
      startWith(this.textForm.getRawValue()),
      pairwise(),
      map(([prev, curr]) => {
        const keys = Object.keys(curr) as (keyof FormText)[];
        const changedKey = keys.find(key => prev[key] !== curr[key]);
        if (!changedKey) return undefined;
        let newValue = curr[changedKey];
        if (changedKey === 'fontSize') newValue = Number(newValue);
        return { key: changedKey, value: newValue };
      })
    ),
  );

  readonly effectText = effect(() => {
    this.activeHistory = true;

    const changed = this.eventText();
    if (!changed) return;
    if (!this.textForm.valid) return;

    const canvas = this.canvas();
    const actives = canvas.getActiveObjects();
    for (const object of actives) object.set(changed);

    this.bootSelection(actives);
    this.activeHistory = false;
    this.historySaveAction();
    canvas.renderAll();
  });

  public lineForm: FormGroup<{ [K in keyof FormLine]: FormControl<FormLine[K]> }> = new FormGroup({
    strokeWidth: new FormControl(5, { validators: Validators.min(1), nonNullable: true }),
    opacity: new FormControl(1, { nonNullable: true }),
    stroke: new FormControl('#000000', { nonNullable: true }),
    backgroundColor: new FormControl('#000000', { nonNullable: true }),
  });

  private readonly eventLine = toSignal(
    this.lineForm.valueChanges.pipe(
      startWith(this.lineForm.getRawValue()),
      pairwise(),
      map(([prev, curr]) => {
        const keys = Object.keys(curr) as (keyof FormLine)[];
        const changedKey = keys.find(key => prev[key] !== curr[key]);
        if (!changedKey) return undefined;
        let newValue = curr[changedKey];
        if (changedKey === 'strokeWidth') newValue = Number(newValue);
        if (changedKey === 'opacity') newValue = Number(newValue);
        return { key: changedKey, value: newValue };
      })
    ),
  );

  readonly effectLine = effect(() => {
    const changed = this.eventLine();
    if (!changed || !this.lineForm.valid) return;

    const { key, value } = changed;
    const canvas = this.canvas();
    const actives = canvas.getActiveObjects();

    if (key === 'backgroundColor') {
      this.bgIsTransparent.set(false);
    }

    for (const obj of actives) {  
      obj.set({ [key]: value });
      if (key === 'strokeWidth') obj.setCoords();
    }

    canvas.requestRenderAll();
  });

  public setTransparentBg(): void {
    const canvas = this.canvas();
    for (const obj of canvas.getActiveObjects()) {
      obj.set({ backgroundColor: '' });
    }
    const control = this.lineForm.get('backgroundColor')!;
    control.reset('#000000', { emitEvent: false });
    canvas.requestRenderAll();
    this.bgIsTransparent.set(true);
  }


  private get timeLine() {
    return this.canvas().toDatalessJSON(['selectable', 'editable']);
  }

  private historySaveAction(): void {
    if (this.activeHistory || !this.present) return;
    this.undo.push(this.present);
    this.present = this.timeLine;
  }

  private readonly modalService = inject(NgbModal);
  private readonly fileModal = viewChild.required<TemplateRef<NgbActiveModal>>('fileModal');

  private displayInput(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const actives = this.canvas().getActiveObjects();
    if (actives.length >= 1) return;
    this.modalService.open(this.fileModal(), { centered: true });
  }

  public async changeBackground({ files }: HTMLInputElement, modal: NgbActiveModal): Promise<void> {
    if (!files) return;
    const file = files.item(0);
    if (!file) return;

    const background = this.backgroundURL();
    if (background) URL.revokeObjectURL(background);
    this.backgroundURL.set(URL.createObjectURL(file));

    const canvas = this.canvas();
    const newImage = await FabricImage.fromURL(this.backgroundURL()!);
    newImage.scaleToWidth(this.defaultWidth);
    newImage.canvas = canvas;
    canvas.backgroundImage = newImage;
    canvas.renderAll();
    modal.close();
  }

  private startPoint: XY = { x: 0, y: 0 };

  private startGesture({ button, ctrlKey, altKey, clientX, clientY }: MouseEvent): void {
    if (this.isBackgroundSet()) return;

    const canvas = this.canvas();
    if (canvas.getActiveObjects().length >= 1) return;

    if (button === 0 && ctrlKey) {
      this.activeHistory = true;
      this.canvasLineOn.set(true);
      const line = new Line();
      const { top, left } = canvas.calcOffset();
      this.startPoint = { x: clientX - left, y: clientY - top };
      line.set({
        x1: this.startPoint.x,
        y1: this.startPoint.y,
        x2: this.startPoint.x,
        y2: this.startPoint.y,
        stroke: '#000000',
        strokeWidth: 5,
      });
      canvas.add(line);
      this.currentLine.set(line);
      canvas.selection = false;
      canvas.renderAll();
    } else if (button === 0 && altKey) {
      const { top, left } = canvas.calcOffset();
      const text = new Textbox('Texto', { left: clientX - left, top: clientY - top });
      canvas.add(text);
      canvas.setActiveObject(text);
    }
  }

  private updateGesture({ clientX, clientY, shiftKey }: MouseEvent): void {
    if (!this.canvasLineOn()) return;
    const canvas = this.canvas();
    const { top, left } = canvas.calcOffset();
    const line = this.currentLine();
    if (!line) return;

    const pointerX = clientX - left;
    const pointerY = clientY - top;

    if (shiftKey) {
      const dx = pointerX - this.startPoint.x;
      const dy = pointerY - this.startPoint.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      angleDeg = (angleDeg + 360) % 360; // normaliza a [0,360)

      // 4) Snap al múltiplo de 45° más cercano
      const snap = Math.round(angleDeg / 45) * 45;
      const rad = snap * Math.PI / 180;

      // 5) Recalcular punto final encajado
      const x2 = this.startPoint.x + r * Math.cos(rad);
      const y2 = this.startPoint.y + r * Math.sin(rad);
      line.set({ x2, y2 });
    } else {
      // 6) Trazado libre
      line.set({ x2: pointerX, y2: pointerY });
    }

    canvas.renderAll();
  }

  private endGesture(): void {
    if (!this.canvasLineOn()) return;
    const canvas = this.canvas();
    canvas.selection = true;
    this.canvasLineOn.set(false);
    this.activeHistory = false;
    const line = this.currentLine();
    if (!line) return;
    const { x1, y1, x2, y2 } = line.calcLinePoints();
    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    canvas[length < 1 ? 'remove' : 'setActiveObject'](line);
    canvas.renderAll();
    this.historySaveAction();
  }

  public readonly popoverType = signal<'line' | 'textbox' | null>(null);
  private readonly trigger = viewChild.required(NgbPopover);
  readonly leftX = signal(0);
  readonly topY = signal(0);

  private objectSelected(selected: FabricObject[]): void {
    const trigger = this.trigger();
    const puntos: XY[] = [];
    
    for (const obj of selected) {
      const rect = obj.getBoundingRect();
      puntos.push({ x: rect.left, y: rect.top });
      puntos.push({ x: rect.left + rect.width, y: rect.top });
      puntos.push({ x: rect.left, y: rect.top + rect.height });
      puntos.push({ x: rect.left + rect.width, y: rect.top + rect.height });
    }
    const { left, top, width, height } = makeBoundingBoxFromPoints(puntos);
    this.leftX.set(left + width / 2);
    this.topY.set(top + height + 8);
    
    if (selected.every(({ type }) => type === 'line')) {
      this.popoverType.set('line');
      
      if (selected.length > 1) {
        this.lineForm.reset({
          strokeWidth: 5,
          opacity: 1,
          stroke: '#000000',
          backgroundColor: '#000000'
        }, { emitEvent: false });
        this.bgIsTransparent.set(true);
        this.lineCap.set('butt');
      } else {
        const line = selected.at(0)!;
        this.lineForm.patchValue({
          strokeWidth: line.strokeWidth,
          opacity: line.opacity,
          stroke: line.stroke as string,
          backgroundColor: line.backgroundColor || '#000000'
        }, { emitEvent: false });
        this.bgIsTransparent.set(!line.backgroundColor);
        this.lineCap.set(line.strokeLineCap);
      }
    } else if (selected.every(({ type }) => type === 'textbox')) {
      this.popoverType.set('textbox');
      
    } else {
      this.popoverType.set(null);
    }

    if (this.popoverType()) {
      if (!trigger.isOpen()) trigger.open();
    } else {
      if (trigger.isOpen()) trigger.close();
    }
  }

  private followSelection(): void {
    const actives = this.canvas().getActiveObjects();
    if (actives.length) {
      this.objectSelected(actives);
    }
  }

  private selectionCleared(): void {
    const trigger = this.trigger();
    if (trigger.isOpen()) trigger.close();
  }

  private readonly strokeWidthInput = viewChild.required<ElementRef<HTMLInputElement>>('swInput');
  private readonly strokeWidthDirective = viewChild.required<NgbTypeahead>('swDirective');
  private readonly STROKE_WIDTHS = Array.from({ length: 20 }, (_, i) => i + 1);
  private readonly destroyRef = inject(DestroyRef);
  public readonly searchStrokeLine = (text$: Observable<string>) => {
    const debounced$ = text$.pipe(debounceTime(200), distinctUntilChanged());
    const { nativeElement: el } = this.strokeWidthInput();
    const focus$ = fromEvent(el, 'focus').pipe(map(() => el.value));
    const click$ = fromEvent(el, 'click').pipe(
      filter(() => !this.strokeWidthDirective().isPopupOpen()),
      map(() => el.value),
    );
    return debounced$.pipe(
      mergeWith(focus$, click$),
      map((term) => {
        const n = parseInt(term, 10);
        if (isNaN(n) || n < 1) return this.STROKE_WIDTHS.slice(0, 10).map(String);
        const divisors = this.STROKE_WIDTHS.filter(w => n % w === 0);
        const multiples = this.STROKE_WIDTHS.filter(w => w % n === 0);
        return [...new Set([...divisors, ...multiples])].slice(0, 10).map(String);
      }),
      takeUntilDestroyed(this.destroyRef),
    );
  };

  readonly lineCap = signal<CanvasLineCap>('butt');
  readonly icoLineCap = computed(() => `ico-${this.lineCap()}`);
  private readonly effectLineCap = effect(() => {
    const strokeLineCap = this.lineCap();
    const canvas = this.canvas();
    for (const obj of canvas.getActiveObjects()) {
      obj.set({ strokeLineCap });
    }
    canvas.requestRenderAll();
  });

  toggleCap() {
    this.lineCap.set(NEXT_CAP[this.lineCap()]);
  }

  ngOnDestroy(): void {
    if (this.unlistenDragDrop) {
      this.unlistenDragDrop();
    }
    const background = this.backgroundURL();
    if (background) URL.revokeObjectURL(background);
  }
}
