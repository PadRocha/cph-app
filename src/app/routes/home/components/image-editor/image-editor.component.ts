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
  background: string;
  backgroundImage: FabricImage;
  hasCustomBackground: boolean;
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
const CANVAS_WIDTH = 708;
const range = (length: number) => Array.from({ length }, (_, i) => i + 1);

@Component({
  selector: 'image-editor',
  imports: [ReactiveFormsModule, NgbPopoverModule, NgbTypeaheadModule, NgbDropdownModule, NgTemplateOutlet],
  templateUrl: './image-editor.component.html',
  styleUrl: './image-editor.component.scss'
})
export class ImageEditorComponent implements OnDestroy {
  /** URL base del backend usado para cargar/guardar imágenes.
   * @category Config
   */
  private readonly apiUrl = environment.httpUrl;

  /** Texto codificable enviado como parámetro extra de localización.
   * @category Config
   */
  private readonly location = environment.location;

  /** Servicio de modales de NG-Bootstrap inyectado para diálogos.
   * @category Inyección
   */
  private readonly modal = inject(NgbModal);

  /** Referencia al ciclo de vida para cancelar efectos RxJS.
   * @category Inyección
   */
  private readonly destroyRef = inject(DestroyRef);

  /** Modelo de tarjeta que se edita; reactivo y obligatorio.
   * @category Entradas
   */
  public readonly item = model.required<ItemModel>();

  /** Índice del elemento dentro de la colección gestionada por el componente padre.
   * El primer elemento tiene índice 0.
   * @category Entradas
   */
  public readonly index = input.required<number>();

  /** Dimensiones en píxeles disponibles para el canvas de trabajo.
   * @category Entradas
   */
  public readonly dimensions = input.required<{ width: number; height: number }>();

  /** Referencia al nodo <canvas> del template usada por Fabric.js.
   * @category Referencias
   */
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** Instancia de NgbPopover que muestra herramientas contextuales.
   * @category Referencias
   */
  private readonly popoverTrigger = viewChild.required(NgbPopover);

  /** Plantilla HTML para seleccionar una imagen desde disco.
   * @category Referencias
   */
  private readonly fileModalTpl = viewChild.required<TemplateRef<NgbActiveModal>>('fileModal');

  /** Canvas Fabric.js inicializado perezosamente y memorizado.
   * @category Canvas
   * @returns Instancia de {@linkcode Canvas} lista para dibujo
   */
  private readonly canvas = computed(() =>
    new Canvas(this.canvasRef().nativeElement, {
      backgroundColor: '#ffffff',
      fireRightClick: true,
      stopContextMenu: true,
      backgroundVpt: true,
      selectionKey: 'altKey',
    })
  );

  /** URL blob actual del fondo cargado por el usuario o nulo.
   * @category Estado
   */
  private readonly backgroundUrl = signal<string | null>(null);

  /** Indicador reactivo de transparencia de fondo en selección
   * @category Estado
   */
  public readonly bgIsTransparent = signal(true);

  /** Indicador reactivo de transparencia de contorno en texto
   * @category Estado
   */
  public readonly strokeIsTransparent = signal(true);

  /** Función de limpieza del listener Tauri DRAG_DROP
   * @category Limpieza
   * @default {null}
   */
  private unlistenDragDrop: UnlistenFn | null = null;

  /** Efecto reactivo que configura el canvas y eventos Fabric
   * @category Efectos
   */
  readonly initCanvasEffect = effect(async () => {
    const canvas = this.canvas();
    canvas.skipTargetFind = true;
    canvas.selection = false;

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
      const baseUrl = `${this.apiUrl}/image/${key}/${image}`;
      const placeholder = await FabricImage.fromURL(
        `${baseUrl}?${queryPlaceholder}`,
        { crossOrigin: 'anonymous' }
      );
      placeholder.scaleToWidth(CANVAS_WIDTH);
      canvas.backgroundImage = placeholder;
      canvas.renderAll();
      url = `${baseUrl}?${queryHigh}`;
      this.backgroundUrl.set(url);
    }
    const image = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
    image.scaleToWidth(CANVAS_WIDTH);
    image.canvas = canvas;
    canvas.backgroundImage = image;
    canvas.renderAll();

    this.currentHistory = this.snapshot;
    this.lastSnapshotHash = JSON.stringify(this.currentHistory)
    canvas.skipTargetFind = false;
    canvas.selection = true;

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
        const background = this.backgroundUrl();
        if (background) URL.revokeObjectURL(background);
        this.backgroundUrl.set(URL.createObjectURL(new Blob([bytes], { type })));
        const newImage = await FabricImage.fromURL(this.backgroundUrl()!);
        newImage.scaleToWidth(CANVAS_WIDTH);
        newImage.canvas = canvas;
        canvas.backgroundImage = newImage;
        this.saveHistory();
        canvas.renderAll();
      }
    });

    const record = () => !this.historyBusy && this.saveHistory();
    canvas.on({
      'object:added': record,
      'object:removed': record,
      'object:modified': record,
      'object:scaling': record,
      'object:rotating': record,
      'object:skewing': record,
      'contextmenu': ({ e }) => {
        e.preventDefault();
        e.stopPropagation();

        if (!canvas.getActiveObjects().length) {
          this.showFileSelector();
          return;
        }

        if (this.activePopover() === 'zorder') {
          this.restoreOrClosePopover();
        } else {
          this.showZOrderMenu();
        }
      },
      'mouse:down': ({ e }) => e instanceof MouseEvent && this.handleGestureStart(e),
      'mouse:move': ({ e }) => e instanceof MouseEvent && this.handleGestureMove(e),
      'mouse:up': () => {
        this.handleGestureEnd();
        const actives = canvas.getActiveObjects();
        if (actives.length) this.onObjectsSelected(actives);
      },
      'selection:created': () => this.onObjectsSelected(canvas.getActiveObjects()),
      'selection:updated': () => this.onObjectsSelected(canvas.getActiveObjects()),
      'text:changed': () => this.onObjectsSelected(canvas.getActiveObjects()),
      'text:editing:exited': ({ target }) => {
        if (!target.text.trim()) {
          canvas.remove(target);
          canvas.requestRenderAll();
        }
      },
      'selection:cleared': () => this.onSelectionCleared(),
      'object:moving': () => this.updateSelectionPosition(),
    });
  });

  /** Efecto que ajusta zoom y tamaño cuando cambian dimensiones
   * @category Efectos
   */
  readonly resizeCanvasEffect = effect(() => {
    const canvas = this.canvas();
    const { width, height } = this.dimensions();
    canvas.setDimensions({ width, height });
    canvas.setZoom(width <= 0 ? 1 : width / CANVAS_WIDTH);
    canvas.renderAll();
  });

  /** Pila de snapshots anteriores para deshacer cambios
   * @category Historial
   */
  private undo: History[] = [];

  /** Pila de snapshots posteriores para rehacer cambios
   * @category Historial
   */
  private redo: History[] = [];

  /** Snapshot actual renderizado en el canvas
   * @category Historial
   */
  private currentHistory: History | null = null;

  /** Flag interno que evita registrar cambios durante carga
   * @category Historial
   */
  private historyBusy = false;

  /** Hash JSON del último snapshot registrado para detectar repetidos
   * @category Historial
   */
  private lastSnapshotHash = '';

  /** Obtiene instantánea serializada del canvas sin datos binarios
   * @category Historial
   * @returns Objeto JSON listo para {@linkcode Canvas.loadFromJSON}
   */
  private get snapshot() {
    return {
      ...this.canvas().toDatalessJSON(['selectable', 'editable']) as History,
      hasCustomBackground: this.backgroundUrl() != null,
    }
  }

  /** Guarda snapshot actual en pila undo y limpia redo
   * @category Historial
   */
  private saveHistory(): void {
    if (!this.currentHistory) return;
    const snap = this.snapshot;
    const hash = JSON.stringify(snap);
    if (hash === this.lastSnapshotHash) return;
    this.undo.push(this.currentHistory);
    this.currentHistory = snap;
    this.lastSnapshotHash = hash;
    this.redo.length = 0;
  }

  /** Restaura un snapshot y marca canvas como renderizado
   * @category Historial
   * @param snap  Snapshot a cargar en el canvas
   */
  private async loadHistory(snap: History): Promise<void> {
    const old = this.backgroundUrl();
    if (old && !snap.hasCustomBackground) {
      URL.revokeObjectURL(old);
      this.backgroundUrl.set(null);
    }

    this.historyBusy = true;
    const canvas = this.canvas();
    await canvas.loadFromJSON(snap);
    canvas.backgroundImage?.scaleToWidth(CANVAS_WIDTH);
    canvas.requestRenderAll();
    this.lastSnapshotHash = JSON.stringify(snap);
    this.historyBusy = false;
  }

  /** Deshace la última acción usando Ctrl + Z
   * @category Comandos
   * @param event  KeyboardEvent ya prevenido
   */
  @HostListener('window:keydown.control.z', ['$event'])
  async undoLastAction(event: KeyboardEvent) {
    event.preventDefault();
    if (this.historyBusy || !this.undo.length) return;

    const prev = this.undo.pop()!;
    if (this.currentHistory) this.redo.push(this.currentHistory);
    this.currentHistory = prev;
    await this.loadHistory(prev);
  }

  /** Rehace la acción deshecha usando Ctrl + Y
   * @category Comandos
   * @param event  KeyboardEvent ya prevenido
   */
  @HostListener('window:keydown.control.y', ['$event'])
  async redoLastAction(event: KeyboardEvent) {
    event.preventDefault();
    if (this.historyBusy || !this.redo.length) return;

    const next = this.redo.pop()!;
    if (this.currentHistory) this.undo.push(this.currentHistory);
    this.currentHistory = next;
    await this.loadHistory(next);
  }

  /** Tipo de popover activo: 'line' 'textbox' 'zorder' o null
   * @category UI
   */
  public readonly activePopover = signal<'line' | 'textbox' | 'zorder' | null>(null);

  /** Popover previo para alternar entre menú de orden y edición
   * @category UI
   */
  private previousPopover: 'line' | 'textbox' | null = null;

  /** Coordenada X del popover relativa al canvas
   * @category UI
   */
  public readonly popoverLeft = signal(0);

  /** Coordenada Y del popover relativa al canvas
   * @category UI
   */
  public readonly popoverTop = signal(0);

  /** Muestra menú contextual de orden Z sobre la selección
   * @category UI
   */
  private showZOrderMenu(): void {
    const popover = this.activePopover();
    if (popover === 'zorder') return;
    this.previousPopover = popover;
    this.activePopover.set('zorder');
    const trig = this.popoverTrigger();
    if (!trig.isOpen()) { trig.open(); }
  }

  /** Restaura popover anterior o lo cierra si no existe
   * @category UI
   */
  private restoreOrClosePopover(): void {
    if (this.previousPopover) {
      this.activePopover.set(this.previousPopover);
    } else {
      this.popoverTrigger().close();
      this.activePopover.set(null);
    }
    this.previousPopover = null;
  }

  /** Aplica función mutadora a cada objeto seleccionado
   * @category Utilidades
   * @param fn  Callback que recibe {@linkcode FabricObject}
   */
  private applyToActiveObjects(fn: (o: FabricObject, canvas: Canvas) => void): void {
    const canvas = this.canvas();
    for (const obj of canvas.getActiveObjects()) {
      fn(obj, canvas)
      obj.dirty = true;
    };
    canvas.requestRenderAll();
  }

  /** Genera stream para autocompletado con focus/click/tecleo
   * @category Utilidades
   * @template T
   * @param el  Input observado
   * @param dir  Instancia NgbTypeahead
   * @param text$  Stream base
   * @param callback  Cálculo de sugerencias
   * @returns Observable<string[]>
   */
  private createTypeaheadStream(
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

  private startPoint: XY = { x: 0, y: 0 };
  private readonly currentLine = signal<Line | null>(null);
  private readonly canvasLineOn = signal(false);

  /** Formulario reactivo para atributos de línea
   * @category Forms
   */
  public readonly lineForm: FormGroupOf<FormLine> = new FormGroup({
    strokeWidth: new FormControl(5, { validators: Validators.min(1), nonNullable: true }),
    opacity: new FormControl(1, { nonNullable: true }),
    stroke: new FormControl('#000000', { nonNullable: true }),
    backgroundColor: new FormControl('#000000', { nonNullable: true }),
  });

  /** Signal con clave/valor del campo de línea recién cambiado
   * @category Forms
   */
  private readonly eventLine = toSignal(
    this.lineForm.valueChanges.pipe(
      debounceTime(200),
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

  /** Efecto que sincroniza cambios de lineForm con selección
   * @category Efectos
   */
  readonly applyLineChangesEffect = effect(() => {
    const changed = this.eventLine();
    if (!changed || !this.lineForm.valid) return;

    const { key, value } = changed;
    if (key === 'backgroundColor') this.bgIsTransparent.set(false);

    this.applyToActiveObjects((o) => {
      o.set({ [key]: value });
      if (key === 'strokeWidth') {
        o.setCoords();
        this.updateSelectionPosition();
      }
    });
    this.saveHistory();
  });

  private readonly strokeWidths = range(20);
  private readonly strokeWidthInput = viewChild.required<ElementRef<HTMLInputElement>>('swInput');
  private readonly strokeWidthDirective = viewChild.required<NgbTypeahead>('swDirective');

  /** Función typeahead para anchos de línea comunes
   * @category Forms
   * @returns Observable<string[]>
   */
  public readonly searchStrokeWidths = (text$: Observable<string>) => this.createTypeaheadStream(
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
  readonly applyLineCapEffect = effect(() => {
    const strokeLineCap = this.lineCap();
    this.applyToActiveObjects((o) => o.set({ strokeLineCap }));
  });

  /** Cicla el tipo de terminación de línea entre butt/round/square
   * @category Herramientas
   */
  public toggleCap(): void {
    this.lineCap.set(NEXT_CAP[this.lineCap()]);
  }

  /** Modo actual del popover de texto: 'text' o 'color'
   * @category UI
   */
  public readonly textboxMode = signal<'text' | 'color'>('text');

  /** Formulario reactivo para atributos tipográficos
   * @category Forms
   */
  public readonly textForm: FormGroupOf<FormText> = new FormGroup({
    fontSize: new FormControl(40, { validators: Validators.min(1), nonNullable: true }),
    fontFamily: new FormControl('Times New Roman', { nonNullable: true }),
    textBackgroundColor: new FormControl('#000000', { nonNullable: true }),
    stroke: new FormControl('#000000', { nonNullable: true }),
    fill: new FormControl('#000000', { nonNullable: true }),
  });

  /** Signal con clave/valor modificado en textForm
   * @category Forms
   */
  private readonly eventText = toSignal(
    this.textForm.valueChanges.pipe(
      debounceTime(200),
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

  /** Efecto que aplica textForm a objetos texto seleccionados
   * @category Efectos
   */
  readonly applyTextChangesEffect = effect(() => {
    const change = this.eventText();

    if (!change || !this.textForm.valid) return;

    const { key, value } = change;
    if (key === "textBackgroundColor") this.bgIsTransparent.set(false);
    if (key === "stroke") this.strokeIsTransparent.set(false);

    this.applyToActiveObjects((o) => {
      o.set({ [key]: value });
      if (key === 'fontSize' || key === "fontFamily") {
        o.setCoords();
        this.updateSelectionPosition();
      }
    });
    this.saveHistory();
  });

  private readonly fontInput = viewChild.required<ElementRef<HTMLInputElement>>('fontInput');
  private readonly fontDirective = viewChild.required<NgbTypeahead>('fontDirective');

  /** Typeahead de nombres de fuente comunes
   * @category Forms
   */
  public readonly searchFontFamilies = (text$: Observable<string>) => this.createTypeaheadStream(
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

  /** Typeahead de tamaños de fuente sugeridos
   * @category Forms
   */
  public readonly searchFontSizes = (text$: Observable<string>) => this.createTypeaheadStream(
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

  /** Alterna negrita en texto seleccionado (Shift + N)
   * @category Atajos
   * @param event  KeyboardEvent opcional
   */
  @HostListener('window:keydown.shift.n', ['$event'])
  public toggleBold(event?: KeyboardEvent): void {
    if (this.activePopover() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isBold.update(v => !v);
  }

  /** Alterna cursiva en texto seleccionado (Shift + K)
   * @category Atajos
   * @param event  KeyboardEvent opcional
   */
  @HostListener('window:keydown.shift.k', ['$event'])
  public toggleItalic(event?: KeyboardEvent): void {
    if (this.activePopover() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isItalic.update(v => !v);
  }

  /** Alterna subrayado en texto (Shift + S)
   * @category Atajos
   * @param event  KeyboardEvent opcional
   */
  @HostListener('window:keydown.shift.s', ['$event'])
  public toggleUnderline(event?: KeyboardEvent): void {
    if (this.activePopover() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isUnderline.update(v => !v);
  }

  /** Alterna sobrelínea en texto (Shift + Alt + S)
   * @category Atajos
   * @param event  KeyboardEvent opcional
   */
  @HostListener('window:keydown.shift.alt.s', ['$event'])
  public toggleOverline(event?: KeyboardEvent): void {
    if (this.activePopover() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isOverline.update(v => !v);
  }

  /** Alterna tachado en texto (Shift + L)
   * @category Atajos
   * @param event  KeyboardEvent opcional
   */
  @HostListener('window:keydown.shift.l', ['$event'])
  public toggleLinethrough(event?: KeyboardEvent): void {
    if (this.activePopover() !== 'textbox') return;
    if (event?.preventDefault) event.preventDefault();
    this.isLinethrough.update(v => !v);
  }

  public readonly textAlign = signal<TextAlign>('left');

  /** Fija alineación de párrafo para texto seleccionado
   * @category Herramientas
   * @param align  Valor de {@linkcode TextAlign}
   */
  public setTextAlign(align: TextAlign): void {
    if (this.textAlign() !== align) {
      this.textAlign.set(align);
    }
  }

  /** Devuelve true si alineación actual coincide
   * @category Herramientas
   * @param align  Valor a comparar
   * @returns boolean
   */
  public isTextAlign(align: TextAlign): boolean {
    return this.textAlign() === align;
  }

  /** Efecto que aplica bold/italic/decoration/alineación
   * @category Efectos
   */
  readonly effectTextStyles = effect(() => {
    const styles = {
      fontWeight: this.isBold() ? 'bold' : 'normal',
      fontStyle: this.isItalic() ? 'italic' : 'normal',
      underline: this.isUnderline(),
      overline: this.isOverline(),
      linethrough: this.isLinethrough(),
      textAlign: this.textAlign(),
    };
    this.applyToActiveObjects((o) => o.set(styles));
    this.saveHistory();
  });

  /** Inicia dibujo de línea (Ctrl+click) o añade Textbox (Alt+click)
   * @category Gestos
   * @param MouseEvent  Evento ratón fuente
   */
  private handleGestureStart({ button, ctrlKey, altKey, clientX, clientY }: MouseEvent): void {
    if (this.backgroundUrl() == null) return;

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

  /** Actualiza línea en curso y aplica snap de 45°
   * @category Gestos
   * @param MouseEvent  Evento ratón fuente
   */
  private handleGestureMove({ clientX, clientY, shiftKey }: MouseEvent): void {
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
      angleDeg = (angleDeg + 360) % 360;

      const snap = Math.round(angleDeg / 45) * 45;
      const rad = snap * Math.PI / 180;
      const x2 = this.startPoint.x + r * Math.cos(rad);
      const y2 = this.startPoint.y + r * Math.sin(rad);
      line.set({ x2, y2 });
    } else {
      line.set({ x2: pointerX, y2: pointerY });
    }

    canvas.renderAll();
  }

  /** Finaliza dibujo de línea y guarda historial
   * @category Gestos
   */
  private handleGestureEnd(): void {
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
    this.saveHistory();
  }

  /** Re-calcula posición del popover según bounding box
   * @category UI
   */
  private updateSelectionPosition(): void {
    const actives = this.canvas().getActiveObjects();
    if (actives.length) {
      this.onObjectsSelected(actives);
    }
  }

  /** Inicializa UI de línea al seleccionar objetos Line
   * @category Selección
   * @param lines  Lista de {@linkcode Line}
   */
  private onSelectLines(lines: Line[]): void {
    this.activePopover.set('line');

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

  /** Inicializa UI de texto al seleccionar objetos Textbox
   * @category Selección
   * @param boxes  Lista de {@linkcode Textbox}
   */
  private onSelectTextboxes(boxes: Textbox[]): void {
    this.activePopover.set('textbox');
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

  /** Decide popover y actualiza ubicación al seleccionar objetos
   * @category Selección
   * @param selected  Objetos activos
   */
  private onObjectsSelected(selected: FabricObject[]): void {
    const trigger = this.popoverTrigger();
    const puntos: XY[] = [];

    for (const obj of selected) {
      const rect = obj.getBoundingRect();
      puntos.push({ x: rect.left, y: rect.top });
      puntos.push({ x: rect.left + rect.width, y: rect.top });
      puntos.push({ x: rect.left, y: rect.top + rect.height });
      puntos.push({ x: rect.left + rect.width, y: rect.top + rect.height });
    }
    const { left, top, width, height } = makeBoundingBoxFromPoints(puntos);
    this.popoverLeft.set(left + width / 2);
    this.popoverTop.set(top + height + 8);

    if (selected.every(({ type }) => type === 'line')) {
      this.onSelectLines(selected as Line[]);
    } else if (selected.every(({ type }) => type === 'textbox')) {
      this.onSelectTextboxes(selected as Textbox[]);
    } else {
      this.activePopover.set(null);
    }

    if (this.activePopover()) {
      if (!trigger.isOpen()) trigger.open();
    } else {
      if (trigger.isOpen()) trigger.close();
    }

    this.previousPopover = null;
  }

  /** Limpia popover y estado al perder la selección
   * @category Selección
   */
  private onSelectionCleared(): void {
    const trigger = this.popoverTrigger();
    if (trigger.isOpen()) trigger.close();
    this.activePopover.set(null);
    this.previousPopover = null;
  }

  /** Descarta selección con Escape
   * @category Comandos
   * @param event  KeyboardEvent prevenido
   */
  @HostListener('window:keydown.escape', ['$event'])
  public clearSelection(event: KeyboardEvent): void {
    event.preventDefault();
    const canvas = this.canvas();
    if (!!canvas.getActiveObjects().length) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }

  /** Envía selección al fondo de la pila Z
   * @category OrdenZ
   */
  public sendObjectsToBack(): void {
    this.applyToActiveObjects((o, canvas) => canvas.sendObjectToBack(o));
    this.saveHistory();
  }

  /** Retrocede selección un nivel en la pila Z
   * @category OrdenZ
   */
  public sendObjectsBackwards(): void {
    this.applyToActiveObjects((o, canvas) => canvas.sendObjectBackwards(o));
    this.saveHistory();
  }

  /** Avanza selección un nivel en la pila Z
   * @category OrdenZ
   */
  public bringObjectsForward(): void {
    this.applyToActiveObjects((o, canvas) => canvas.bringObjectForward(o));
    this.saveHistory();
  }

  /** Trae selección hasta el frente de la pila Z
   * @category OrdenZ
   */
  public bringObjectsToFront(): void {
    this.applyToActiveObjects((o, canvas) => canvas.bringObjectToFront(o));
    this.saveHistory();
  }

  /** Elimina color de fondo de líneas seleccionadas
   * @category Herramientas
   */
  public makeBackgroundTransparent(): void {
    if (this.activePopover() === 'line') {
      this.applyToActiveObjects(o => o.set({ backgroundColor: '' }));
      this.lineForm.get('backgroundColor')!.reset('#000000', { emitEvent: false });
    } else {
      this.applyToActiveObjects(o => o.set({ textBackgroundColor: '' }));
      this.textForm.get('textBackgroundColor')!.reset('#000000', { emitEvent: false });
    }
    this.bgIsTransparent.set(true);
    this.saveHistory();
  }

  /** Elimina contorno de texto seleccionado
   * @category Herramientas
   */
  public makeStrokeTransparent(): void {
    this.applyToActiveObjects((o) => o.set({ stroke: '' }));
    const control = this.textForm.get('stroke')!;
    control.reset('#000000', { emitEvent: false });
    this.strokeIsTransparent.set(true);
    this.saveHistory();
  }

  /** Abre modal para cargar imagen cuando no hay selección
   * @category UI
   */
  private showFileSelector(): void {
    const actives = this.canvas().getActiveObjects();
    if (actives.length >= 1) return;
    this.modal.open(this.fileModalTpl(), { centered: true });
  }

  /** Sustituye imagen de fondo con archivo local
   * @category Importación
   * @param inputFile  Input de tipo file con imagen
   * @param modal  Instancia del modal activo
   * @throws Deno.errors.InvalidData si tipo MIME no es imagen
   */
  public async updateBackgroundImage({ files }: HTMLInputElement, modal: NgbActiveModal): Promise<void> {
    if (!files) return;
    const file = files.item(0);
    if (!file) return;

    const background = this.backgroundUrl();
    if (background) URL.revokeObjectURL(background);
    this.backgroundUrl.set(URL.createObjectURL(file));

    const canvas = this.canvas();
    const newImage = await FabricImage.fromURL(this.backgroundUrl()!);
    newImage.scaleToWidth(CANVAS_WIDTH);
    newImage.canvas = canvas;
    canvas.backgroundImage = newImage;
    this.saveHistory();
    canvas.renderAll();
    modal.close();
  }

  /** Libera recursos: listeners Tauri y blobs de fondo
   * @category CicloVida
   */
  ngOnDestroy(): void {
    if (this.unlistenDragDrop) {
      this.unlistenDragDrop();
    }
    const background = this.backgroundUrl();
    if (background) URL.revokeObjectURL(background);
  }

  async export() {
    return await this.canvas().toBlob({ format: 'jpeg', quality: 1, multiplier: 1, enableRetinaScaling: true });
  }
}
