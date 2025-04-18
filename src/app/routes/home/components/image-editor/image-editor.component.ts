import { Component, computed, effect, ElementRef, HostListener, inject, input, model, OnDestroy, signal, TemplateRef, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '@environment';
import { ItemModel } from '@home/models';
import { NgbActiveModal, NgbModal, NgbPopover, NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';
import { listen, TauriEvent, UnlistenFn } from '@tauri-apps/api/event';
import { extname } from '@tauri-apps/api/path';
import { readFile } from '@tauri-apps/plugin-fs';
import { ActiveSelection, Canvas, FabricImage, FabricObject, Line, Textbox, XY } from 'fabric';
import { makeBoundingBoxFromPoints } from 'node_modules/fabric/dist/src/util';
import { map, pairwise, startWith } from 'rxjs';

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

@Component({
  selector: 'image-editor',
  imports: [ReactiveFormsModule, NgbPopoverModule],
  templateUrl: './image-editor.component.html',
  styleUrl: './image-editor.component.scss'
})
export class ImageEditorComponent implements OnDestroy {
  // ========================
  // 1. Constantes & Entorno
  // ========================
  private readonly defaultWidth = 708;
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;

  // =========================
  // 2. Inputs del Componente
  // =========================
  public readonly item = model.required<ItemModel>();
  public readonly index = input.required<number>();
  public readonly dimensions = input.required<{ width: number; height: number }>();

  // ===================================
  // 3. ViewChilds y Referencias Canvas
  // ===================================
  private readonly canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly canvas = computed(() =>
    new Canvas(this.canvasElement().nativeElement, {
      backgroundColor: '#ffffff',
      // fireRightClick: true,
      stopContextMenu: true,
      backgroundVpt: true,
    })
  );

  // ==================================================
  // 4. Control Drag&Drop y Señal de fondo del Canvas
  // ==================================================
  private unlistenDragDrop: UnlistenFn | null = null;
  private readonly backgroundURL = signal<string | null>(null);
  public readonly isBackgroundSet = computed(() => !!this.backgroundURL());

  // =====================
  // 5. Efectos Principales
  // =====================
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

  // ============================
  // 6. Variables Internas & Flags
  // ============================
  private currentLine = signal<Line | null>(null);
  private canvasLineOn = signal(false);
  private undo: History[] = [];
  private redo: History[] = [];
  private present: History | null = null;
  private activeHistory = false;

  public menuLineOn = false;
  public menuTextOn = false;
  public menuColorOn = false;

  // ==================================
  // 7. Métodos Auxiliares de Selección
  // ==================================
  private bootSelection<T extends FabricObject>(actives: T[]): void {
    const canvas = this.canvas();
    canvas.discardActiveObject();
    const selection = new ActiveSelection(actives, { canvas });
    canvas.setActiveObject(selection);
  }

  // ====================
  // 8. Formularios (Text)
  // ====================
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

  // ====================
  // 9. Formularios (Line)
  // ====================
  public lineForm: FormGroup<{ [K in keyof FormLine]: FormControl<FormLine[K]> }> = new FormGroup({
    strokeWidth: new FormControl(5, { validators: Validators.min(1), nonNullable: true }),
    opacity: new FormControl(1, { nonNullable: true }),
    stroke: new FormControl('', { nonNullable: true }),
    backgroundColor: new FormControl('', { nonNullable: true }),
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
    this.activeHistory = true;

    const changed = this.eventLine();
    if (!changed) return;
    if (!this.lineForm.valid) return;

    const canvas = this.canvas();
    const actives = canvas.getActiveObjects();
    for (const object of actives) object.set(changed);

    this.bootSelection(actives);
    this.activeHistory = false;
    this.historySaveAction();
    canvas.renderAll();
  });

  // =========================
  // 10. Getters y Historial
  // =========================
  private get timeLine() {
    return this.canvas().toDatalessJSON(['selectable', 'editable']);
  }

  private historySaveAction(): void {
    if (this.activeHistory || !this.present) return;
    this.undo.push(this.present);
    this.present = this.timeLine;
  }

  // ======================================
  // 11. Inyección de Servicios y Modales
  // ======================================
  private readonly modalService = inject(NgbModal);
  private readonly fileModal = viewChild.required<TemplateRef<HTMLDivElement>>('fileModal');

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

  // ======================================
  // 12. Control del Mouse (Líneas, Texto)
  // ======================================
  private startGesture({ button, ctrlKey, altKey, clientX, clientY }: MouseEvent): void {
    if (this.isBackgroundSet()) return;

    const canvas = this.canvas();
    if (canvas.getActiveObjects().length >= 1) return;

    if (button === 0 && ctrlKey) {
      this.activeHistory = true;
      this.canvasLineOn.set(true);
      const line = new Line();
      const { top, left } = canvas.calcOffset();
      line.set({
        x1: clientX - left,
        y1: clientY - top,
        x2: clientX - left,
        y2: clientY - top,
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

  private updateGesture({ clientX, clientY }: MouseEvent): void {
    if (!this.canvasLineOn()) return;
    const canvas = this.canvas();
    const { top, left } = canvas.calcOffset();
    const line = this.currentLine();
    if (!line) return;
    line.set({
      x2: clientX - left,
      y2: clientY - top,
    });
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
    const { x1, y1 } = line.calcLinePoints();
    const isOff = Math.abs(x1) < 1 || Math.abs(y1) < 1;
    canvas[isOff ? 'remove' : 'setActiveObject'](line);
    canvas.renderAll();
    this.historySaveAction();
  }

  // =============================
  // 13. Popovers y Selección de objetos
  // =============================
  private readonly linePopover = viewChild.required<TemplateRef<unknown>>('linePopover');
  private readonly textPopover = viewChild.required<TemplateRef<unknown>>('textPopover');
  private readonly trigger = viewChild.required<NgbPopover>(NgbPopover);
  readonly leftX = signal(0);
  readonly topY = signal(0);

  private objectSelected(selected: FabricObject[]): void {
    const canvas = this.canvas();
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

    const trigger = this.trigger();
    const allLines = selected.every(obj => obj.type === 'line');
    const allTexts = selected.every(obj => obj.type === 'textbox');

    if (allLines && (!trigger.isOpen() || trigger.ngbPopover !== this.linePopover())) {
      trigger.ngbPopover = this.linePopover();
      if (!trigger.isOpen()) setTimeout(() => trigger.open());
    } else if (allTexts && (!trigger.isOpen() || trigger.ngbPopover !== this.textPopover())) {
      trigger.ngbPopover = this.textPopover();
      if (!trigger.isOpen()) setTimeout(() => trigger.open());
    } else if (!allLines && !allTexts && trigger.isOpen()) {
      trigger.close();
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

  // ==================
  // 14. Ciclo de Vida
  // ==================
  ngOnDestroy(): void {
    if (this.unlistenDragDrop) {
      this.unlistenDragDrop();
    }
    const background = this.backgroundURL();
    if (background) URL.revokeObjectURL(background);
  }
}
