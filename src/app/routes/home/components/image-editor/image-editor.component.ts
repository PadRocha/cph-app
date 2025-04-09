import { Component, ElementRef, HostListener, input, Input, model, OnChanges, OnInit, signal, viewChild, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ItemModel } from '@home/models';
// import { ControlsOf } from '@home/models/form';
import { ItemService } from '@home/services';
// import { InputSelectComponent } from '@shared/components';
// import { MediaService } from '@shared/services';
// import { FormValidator } from '@shared/utils/FormValidator';
import { FabricImage, Canvas, FabricObject } from 'fabric';
import { lastValueFrom, map, pairwise, startWith } from 'rxjs';

type CanvasEvent = MouseEvent & { target: HTMLCanvasElement };

interface Text {
  fontSize: number | null;
  fontFamily: string;
  textBackgroundColor: string;
  stroke: string;
  fill: string;
}

interface Line {
  strokeWidth: number | null;
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
  imports: [],
  templateUrl: './image-editor.component.html',
  styleUrl: './image-editor.component.scss'
})
export class ImageEditorComponent {
  public item = input.required<ItemModel>();
  private canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasElement');
  private canvas = new Canvas(this.canvasElement().nativeElement, {
    backgroundColor: '#ffffff',
    fireRightClick: true,
    stopContextMenu: true,
    // width: this.width,
    // height: this.height,
  });
  private canvasImage = signal<FabricImage | null>(null);
  private currentLine = signal<FabricObject | null>(null);
  private canvasLineOn = signal(false);
  private canvasBackgroundSetted = signal(false);

  private undo: History[] = [];
  private redo: History[] = [];
  private present: History | null = null;

  public menuInsertOn = false;
  public menuLineOn = false;
  public menuTextOn = false;
  public menuColorOn = false;

  public text_form: FormGroup<{ [K in keyof Text]: FormControl<Text[K]> }> = new FormGroup({
    fontSize: new FormControl(40, { validators: Validators.min(1) }),
    fontFamily: new FormControl('Times New Roman', { nonNullable: true }),
    textBackgroundColor: new FormControl('', { nonNullable: true }),
    stroke: new FormControl('', { nonNullable: true }),
    fill: new FormControl('rgb(0,0,0)', { nonNullable: true }),
  });;
  public line_form: FormGroup<{ [K in keyof Line]: FormControl<Line[K]> }> = new FormGroup({
    strokeWidth: new FormControl(5, { validators: Validators.min(1) }),
    opacity: new FormControl(1, { nonNullable: true }),
    stroke: new FormControl('', { nonNullable: true }),
    backgroundColor: new FormControl('', { nonNullable: true }),
  });
}
