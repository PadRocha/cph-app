import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, input, model, OnDestroy, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '@environment';
import { ItemModel } from '@home/models';
import { NgbActiveModal, NgbDropdownModule, NgbModal, NgbPopover, NgbPopoverModule, NgbTypeahead, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { listen, TauriEvent, UnlistenFn } from '@tauri-apps/api/event';
import { extname } from '@tauri-apps/api/path';
import { readFile } from '@tauri-apps/plugin-fs';
import { Canvas, FabricImage, FabricObject, Line, Textbox, XY } from 'fabric';
import { makeBoundingBoxFromPoints } from 'node_modules/fabric/dist/src/util';
import { debounceTime, distinctUntilChanged, filter, fromEvent, map, mergeWith, Observable, pairwise, startWith } from 'rxjs';

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

type FormGroupOf<T> = FormGroup<{ [K in keyof T]: FormControl<T[K]>; }>;
type TextAlign = CanvasTextAlign | 'justify';

const NEXT_CAP: Record<CanvasLineCap, CanvasLineCap> = {
  butt: 'round',
  round: 'square',
  square: 'butt'
};
const FONT_NAMES = [
  'Times New Roman',
  'Arial',
  'Helvetica',
  'Myriad Pro',
  'Delicious',
  'Verdana',
  'Georgia',
  'Courier',
  'Comic Sans Ms',
  'Impact',
  'Monaco',
  'Optima',
  'Hoefler Text',
  'Plaster',
  'Engagement',
];
const range = (length: number) => Array.from({ length }, (_, i) => i + 1);

@Component({
  selector: 'image-editor',
  imports: [ReactiveFormsModule, NgbPopoverModule, NgbTypeaheadModule, NgbDropdownModule, NgTemplateOutlet],
  templateUrl: './image-editor.component.html',
  styleUrl: './image-editor.component.scss'
})
export class ImageEditorComponent implements OnDestroy {
  private readonly defaultWidth = 708;
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;

  private readonly modalService = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);

  public readonly item = model.required<ItemModel>();
  public readonly index = input.required<number>();
  public readonly dimensions = input.required<{ width: number; height: number }>();

  private readonly canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly trigger = viewChild.required(NgbPopover);
  private readonly fileModal = viewChild.required<TemplateRef<NgbActiveModal>>('fileModal');

  private readonly canvas = computed(() =>
    new Canvas(this.canvasElement().nativeElement, {
      backgroundColor: '#ffffff',
      fireRightClick: true,
      stopContextMenu: true,
      backgroundVpt: true,
    })
  );
  private readonly backgroundURL = signal<string | null>(null);
  public readonly bgIsTransparent = signal(true);
  public readonly strokeIsTransparent = signal(true);

  private unlistenDragDrop: UnlistenFn | null = null;

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
    this.present = this.snapshot;
    canvas.skipTargetFind = false;
    canvas.selection = true;
    canvas.selectionKey = 'altKey';

    this.unlistenDragDrop = await listen<{ paths: string[] }>(TauriEvent.DRAG_DROP, async (event) => {
      if (Array.isArray(event.payload?.paths) && event.payload.paths.length > 0) {
        const [filePath] = event.payload.paths;
        const bytes = await readFile(filePath);
        const ext = await extname(filePath);
        if (!['jpg', 'jpeg', 'png'].includes(ext.toLowerCase())) return;
        const mimeTypes: Record<string, string> = {
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
      'object:added': () => this.historySave(),
      'object:removed': () => this.historySave(),
      'object:modified': () => this.historySave(),
      'object:skewing': () => this.historySave(),
      'contextmenu': ({ e }) => {
        e.preventDefault();
        e.stopPropagation();

        if (!canvas.getActiveObjects().length) {
          this.displayInput(e);            // no hay selección → input
          return;
        }

        if (this.popoverType() === 'zorder') {
          this.backToPrevOrClose();        // está abierto → volver / cerrar
        } else {
          this.openZOrderMenu();           // no está → abrir
        }
      },
      'mouse:down': ({ e }) => e instanceof MouseEvent && this.startGesture(e),
      'mouse:move': ({ e }) => e instanceof MouseEvent && this.updateGesture(e),
      'mouse:up': () => {
        this.endGesture();
        const actives = canvas.getActiveObjects();
        if (actives.length) this.objectSelected(actives);
      },
      'selection:created': () => this.objectSelected(canvas.getActiveObjects()),
      'selection:updated': () => this.objectSelected(canvas.getActiveObjects()),
      'text:changed': () => this.objectSelected(canvas.getActiveObjects()),
      'text:editing:exited': ({ target }) => {
        if (!target.text.trim()) {
          canvas.remove(target);
          canvas.requestRenderAll();
        }
      },
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

  private undo: History[] = [];
  private redo: History[] = [];
  private present: History | null = null;
  private historyBusy = false;

  private get snapshot() {
    return this.canvas().toDatalessJSON(['selectable', 'editable']) as History;
  }
  private historySave(): void {
    if (this.historyBusy || !this.present) return;
    this.undo.push(this.present);
    this.present = this.snapshot;
    this.redo.length = 0;
  }

  private applyHistory(snapshot: History): void {
    const canvas = this.canvas();
    this.historyBusy = true;
    canvas.loadFromJSON(snapshot, () => {
      canvas.requestRenderAll();
      this.historyBusy = false;
    });
  }

  public readonly popoverType = signal<'line' | 'textbox' | 'zorder' | null>(null);
  private prevPopoverType: 'line' | 'textbox' | null = null;
  readonly leftX = signal(0);
  readonly topY = signal(0);

  private openZOrderMenu(): void {
    const popover = this.popoverType();
    if (popover === 'zorder') return;
    this.prevPopoverType = popover;
    this.popoverType.set('zorder');
    const trig = this.trigger();
    if (!trig.isOpen()) { trig.open(); }
  }
  private backToPrevOrClose(): void {
    if (this.prevPopoverType) {
      this.popoverType.set(this.prevPopoverType);
    } else {
      this.trigger().close();
      this.popoverType.set(null);
    }
    this.prevPopoverType = null;
  }

  private withActives(fn: (o: FabricObject) => void): void {
    const canvas = this.canvas();
    for (const obj of canvas.getActiveObjects()) fn(obj);
    canvas.requestRenderAll();
  }

  private startPoint: XY = { x: 0, y: 0 };
  private currentLine = signal<Line | null>(null);
  private canvasLineOn = signal(false);

  public lineForm: FormGroupOf<FormLine> = new FormGroup({
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
    if (key === 'backgroundColor') this.bgIsTransparent.set(false);

    this.withActives((o) => {
      o.set({ [key]: value });
      if (key === 'strokeWidth') {
        o.setCoords();
        this.followSelection();
      }
    });
    // this.historySave();
  });

  private typeahead(
    { nativeElement: el }: ElementRef<HTMLInputElement>,
    dir: NgbTypeahead,
    text$: Observable<string>,
    callback: (v: string) => any
  ) {
    const focus$ = fromEvent(el, 'focus').pipe(map(() => el.value));
    const click$ = fromEvent(el, 'click').pipe(filter(() => !dir.isPopupOpen()), map(() => el.value));
    return text$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      mergeWith(focus$, click$),
      map(callback),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  private readonly strokeWidths = range(20);
  private readonly strokeWidthInput = viewChild.required<ElementRef<HTMLInputElement>>('swInput');
  private readonly strokeWidthDirective = viewChild.required<NgbTypeahead>('swDirective');
  public readonly searchStrokeLine = (text$: Observable<string>) => this.typeahead(
    this.strokeWidthInput(),
    this.strokeWidthDirective(),
    text$,
    (term) => {
      const n = parseInt(term, 10);
      if (isNaN(n) || n < 1) return this.strokeWidths.slice(0, 10).map(String);
      const divisors = this.strokeWidths.filter(w => n % w === 0);
      const multiples = this.strokeWidths.filter(w => w % n === 0);
      return [...new Set([...divisors, ...multiples])].slice(0, 10).map(String);
    }
  );

  readonly lineCap = signal<CanvasLineCap>('butt');
  readonly icoLineCap = computed(() => `ico-${this.lineCap()}`);
  private readonly effectLineCap = effect(() => {
    const strokeLineCap = this.lineCap();
    this.withActives((o) => o.set({ strokeLineCap }));
  });
  public toggleCap(): void {
    this.lineCap.set(NEXT_CAP[this.lineCap()]);
  }

  public readonly textboxMode = signal<'text' | 'color'>('text');
  public textForm: FormGroupOf<FormText> = new FormGroup({
    fontSize: new FormControl(40, { validators: Validators.min(1), nonNullable: true }),
    fontFamily: new FormControl('Times New Roman', { nonNullable: true }),
    textBackgroundColor: new FormControl('#000000', { nonNullable: true }),
    stroke: new FormControl('#000000', { nonNullable: true }),
    fill: new FormControl('#000000', { nonNullable: true }),
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
    const change = this.eventText();

    if (!change || !this.textForm.valid) return;

    const { key, value } = change;
    if (key === "textBackgroundColor") this.bgIsTransparent.set(false);
    if (key === "stroke") this.strokeIsTransparent.set(false);

    this.withActives((o)=> {
      o.set({ [key]: value });
      if (key === 'fontSize' || key === "fontFamily") {
        o.setCoords();
        this.followSelection();
      }
    });
    // this.historySave();
  });

  private readonly fontInput = viewChild.required<ElementRef<HTMLInputElement>>('fontInput');
  private readonly fontDirective = viewChild.required<NgbTypeahead>('fontDirective');
  public readonly searchFont = (text$: Observable<string>) => this.typeahead(
    this.fontInput(),
    this.fontDirective(),
    text$,
    (term) => {
      if (term === '') return FONT_NAMES.slice(0, 10);
      return FONT_NAMES
        .filter((name) => name.toLowerCase().includes(term.toLowerCase()))
        .slice(0, 10);
    }
  );

  private readonly fontSizeInput = viewChild.required<ElementRef<HTMLInputElement>>('fsInput');
  private readonly fontSizeDirective = viewChild.required<NgbTypeahead>('fsDirective');
  private readonly widthSizes = range(160);
  public readonly searchSize = (text$: Observable<string>) => this.typeahead(
    this.fontSizeInput(),
    this.fontSizeDirective(),
    text$,
    (term) => {
      const n = parseInt(term, 10);
      if (isNaN(n) || n < 1) return this.widthSizes.slice(0, 10).map(String);
      const divisors = this.widthSizes.filter(w => n % w === 0);
      const multiples = this.widthSizes.filter(w => w % n === 0);
      return [...new Set([...divisors, ...multiples])].slice(0, 10).map(String);
    }
  );

  public readonly isBold = signal(false);
  public readonly isItalic = signal(false);
  public readonly isUnderline = signal(false);
  public readonly isOverline = signal(false);
  public readonly isLinethrough = signal(false);

  @HostListener('window:keydown.shift.n', ['$event'])
  public toggleBold(event?: KeyboardEvent): void {
    if (this.popoverType() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isBold.update(v => !v);
  }
  @HostListener('window:keydown.shift.k', ['$event'])
  public toggleItalic(event?: KeyboardEvent): void {
    if (this.popoverType() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isItalic.update(v => !v);
  }
  @HostListener('window:keydown.shift.s', ['$event'])
  public toggleUnderline(event?: KeyboardEvent): void {
    if (this.popoverType() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isUnderline.update(v => !v);
  }
  @HostListener('window:keydown.shift.alt.s', ['$event'])
  public toggleOverline(event?: KeyboardEvent): void {
    if (this.popoverType() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isOverline.update(v => !v);
  }
  @HostListener('window:keydown.shift.l', ['$event'])
  public toggleLinethrough(event?: KeyboardEvent): void {
    if (this.popoverType() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isLinethrough.update(v => !v);
  }
  @HostListener('window:keydown.escape', ['$event'])
  public clearSelection(event: KeyboardEvent): void {
    event.preventDefault();
    const canvas = this.canvas();
    if (!!canvas.getActiveObjects().length) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }
  @HostListener('window:keydown.control.z', ['$event'])
  public undoCanvas(event: KeyboardEvent) {
    // event.preventDefault();
    // this.history_off = true;
    // const timeLine = this.history_undo.pop();
    // if (!!timeLine) {
    //   this.history_redo.push(this.timeLine);
    //   this.history_present = timeLine;
    //   this.canvas.loadFromJSON(timeLine, () => {
    //     this.canvas.requestRenderAll();
    //     this.history_off = false;
    //   });
    // } else
    //   this.history_off = false;
  }
  @HostListener('window:keydown.control.y', ['$event'])
  public redoCanvas(event: KeyboardEvent) {
    // event.preventDefault();
    // this.history_off = true;
    // const timeLine = this.history_redo.pop();
    // if (!!timeLine) {
    //   this.history_undo.push(this.timeLine);
    //   this.history_present = timeLine;
    //   this.canvas.loadFromJSON(timeLine, () => {
    //     this.canvas.requestRenderAll();
    //     this.history_off = false;
    //   });
    // } else
    //   this.history_off = false;
  }

  public readonly textAlign = signal<TextAlign>('left');

  public setTextAlign(align: TextAlign): void {
    if (this.textAlign() !== align) {
      this.textAlign.set(align);
    }
  }
  public isTextAlign(align: TextAlign): boolean {
    return this.textAlign() === align;
  }

  readonly effectTextStyles = effect(() => {
    const styles = {
      fontWeight: this.isBold() ? 'bold' : 'normal',
      fontStyle: this.isItalic() ? 'italic' : 'normal',
      underline: this.isUnderline(),
      overline: this.isOverline(),
      linethrough: this.isLinethrough(),
      textAlign: this.textAlign(),
    };
    this.withActives((o) => o.set(styles));
  });

  private startGesture({ button, ctrlKey, altKey, clientX, clientY }: MouseEvent): void {
    if (this.backgroundURL()) return;

    const canvas = this.canvas();
    if (canvas.getActiveObjects().length >= 1) return;

    if (button === 0 && ctrlKey) {
      this.historyBusy = true;
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
    this.historyBusy = false;
    const line = this.currentLine();
    if (!line) return;
    const { x1, y1, x2, y2 } = line.calcLinePoints();
    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    canvas[length < 1 ? 'remove' : 'setActiveObject'](line);
    canvas.renderAll();
    this.historySave();
  }

  private followSelection(): void {
    const actives = this.canvas().getActiveObjects();
    if (actives.length) {
      this.objectSelected(actives);
    }
  }

  private selectLines(lines: Line[]): void {
    this.popoverType.set('line');

    if (lines.length > 1) {
      this.lineForm.reset({
        strokeWidth: 5,
        opacity: 1,
        stroke: '#000000',
        backgroundColor: '#000000'
      }, { emitEvent: false });
      this.bgIsTransparent.set(true);
      this.lineCap.set('butt');
    } else {
      const line = lines.at(0)!;
      this.lineForm.patchValue({
        strokeWidth: line.strokeWidth,
        opacity: line.opacity,
        stroke: line.stroke as string,
        backgroundColor: line.backgroundColor || '#000000'
      }, { emitEvent: false });
      this.bgIsTransparent.set(!line.backgroundColor);
      this.lineCap.set(line.strokeLineCap);
    }
  }

  private selectTextboxes(boxes: Textbox[]): void {
    this.popoverType.set('textbox');
    this.textboxMode.set('text');
    if (boxes.length > 1) {
      this.textForm.reset({
        fontSize: 40,
        fontFamily: 'Times New Roman',
        textBackgroundColor: '#000000',
        stroke: '#000000',
        fill: '#000000',
      }, { emitEvent: false });

      this.bgIsTransparent.set(true);
      this.strokeIsTransparent.set(true);

      this.isBold.set(false);
      this.isItalic.set(false);
      this.isUnderline.set(false);
      this.isOverline.set(false);
      this.isLinethrough.set(false);
      this.textAlign.set('left');
    } else {
      const textbox = boxes.at(0)! as Textbox;

      this.textForm.patchValue({
        fontSize: textbox.fontSize,
        fontFamily: textbox.fontFamily,
        textBackgroundColor: textbox.textBackgroundColor || '#000000',
        stroke: textbox.stroke as string || '#000000',
        fill: textbox.fill as string,
      }, { emitEvent: false });

      this.bgIsTransparent.set(!textbox.textBackgroundColor);
      this.strokeIsTransparent.set(!textbox.stroke);

      this.isBold.set(textbox.fontWeight === 'bold');
      this.isItalic.set(textbox.fontStyle === 'italic');
      this.isUnderline.set(!!textbox.underline);
      this.isOverline.set(!!textbox.overline);
      this.isLinethrough.set(!!textbox.linethrough);
      this.textAlign.set(textbox.textAlign as any ?? 'left');
    }
  }

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
      this.selectLines(selected as Line[]);
    } else if (selected.every(({ type }) => type === 'textbox')) {
      this.selectTextboxes(selected as Textbox[]);
    } else {
      this.popoverType.set(null);
    }

    if (this.popoverType()) {
      if (!trigger.isOpen()) trigger.open();
    } else {
      if (trigger.isOpen()) trigger.close();
    }

    this.prevPopoverType = null;
  }

  private selectionCleared(): void {
    const trigger = this.trigger();
    if (trigger.isOpen()) trigger.close();
    this.popoverType.set(null);
    this.prevPopoverType = null;
  }

  public sendToBack(): void {
    const canvas = this.canvas();
    for (const obj of canvas.getActiveObjects()) {
      canvas.sendObjectToBack(obj);
    }
    canvas.requestRenderAll();
    this.historySave();
  }

  public sendBackwards(): void {
    const canvas = this.canvas();
    for (const obj of canvas.getActiveObjects()) {
      canvas.sendObjectBackwards(obj);
    }
    canvas.requestRenderAll();
    canvas.discardActiveObject();
    this.historySave();
  }

  public bringForward(): void {
    const canvas = this.canvas();
    for (const obj of canvas.getActiveObjects()) {
      canvas.bringObjectForward(obj);
    }
    canvas.requestRenderAll();
    this.historySave();
  }

  public bringToFront(): void {
    const canvas = this.canvas();
    for (const obj of canvas.getActiveObjects()) {
      canvas.bringObjectToFront(obj);
    }
    canvas.requestRenderAll();
    this.historySave();
  }

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

  public setTransparentStroke(): void {
    const canvas = this.canvas();
    for (const obj of canvas.getActiveObjects()) {
      obj.set({ stroke: '' });
    }
    const control = this.textForm.get('stroke')!;
    control.reset('#000000', { emitEvent: false });
    canvas.requestRenderAll();
    this.strokeIsTransparent.set(true);
  }

  private displayInput(event: Event): void {
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

  ngOnDestroy(): void {
    if (this.unlistenDragDrop) {
      this.unlistenDragDrop();
    }
    const background = this.backgroundURL();
    if (background) URL.revokeObjectURL(background);
  }
}
