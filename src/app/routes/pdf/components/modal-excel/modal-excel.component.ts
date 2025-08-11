import { Component, computed, effect, inject, input, signal, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PDFData, Search } from '@pdf/models';
import { ItemService } from '@pdf/services';
import { utils, write } from 'xlsx';
import { Subscription } from 'rxjs';
import { ThemeDirective } from '@shared/directives';

@Component({
  selector: 'app-modal-excel',
  standalone: true,
  templateUrl: './modal-excel.component.html',
  styleUrl: './modal-excel.component.scss',
  hostDirectives: [ThemeDirective],
})
export class ModalExcelComponent implements OnDestroy {
  private readonly itemService = inject(ItemService);
  private readonly active = inject(NgbActiveModal);

  public readonly params = input.required<Search>();
  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly rows = signal<PDFData[]>([]);
  public readonly preview = computed(() => this.rows().slice(0, 10));

  private sub?: Subscription;

  // tips rotativos como en el modal PDF
  private readonly tips = [
    'Consultando y agrupando items…',
    'Calculando columnas y formatos…',
    'Generando hoja de cálculo…',
    'Normalizando valores nulos…',
    'Aplicando formatos de celda…',
    'Preparando vista previa…',
    'Acomodando filas impacientes…',
    'Puliendo bordes del .xlsx…',
    'Último sorbo de café para la CPU…',
  ] as const;
  public readonly tip = signal<typeof this.tips[number]>(this.tips[0]);
  private tipTimer: number | null = null;
  private tipIndex = 0;
  private tipsSeen = 0;

  public readonly _ = effect(() => {
    const p = this.params();
    this.load(p);
  });

  public load(params: Search) {
    this.sub?.unsubscribe();
    this.startTips();
    this.loading.set(true);
    this.error.set(null);
    this.rows.set([]);

    this.sub = this.itemService.getData(params).subscribe({
      next: ({ done, data }) => {
        // ignoramos "progress" porque no es fiable en este flujo
        if (done && data) this.rows.set(data);
      },
      error: () => this.error.set('Ocurrió un error al descargar los datos'),
    });

    this.sub.add(() => {
      this.stopTips();
      this.loading.set(false);
    });
  }

  public retry() {
    this.load(this.params());
  }

  public getExcel() {
    const data = this.rows();
    if (!data.length) return;
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Datos');
    const buf = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob(
      [buf],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const search = this.params().search || 'sin_busqueda';
    a.download = `export_${search}_${Date.now()}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  public close() {
    this.sub?.unsubscribe();
    this.stopTips();
    return this.active.dismiss();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.stopTips();
  }

  private startTips() {
    this.stopTips();
    this.tipIndex = 0;
    this.tipsSeen = 0;
    this.tip.set(this.tips[this.tipIndex]);
    this.scheduleNextTip();
  }

  private scheduleNextTip() {
    const base = 3_000;
    const step = 500;
    const max = 12_000;
    const jitter = 0;

    const delay = Math.min(base + this.tipsSeen * step, max) + jitter;

    this.tipTimer = window.setTimeout(() => {
      this.tipIndex = (this.tipIndex + 1) % this.tips.length;
      this.tip.set(this.tips[this.tipIndex]);
      this.tipsSeen++;
      this.scheduleNextTip();
    }, Math.max(0, delay));
  }

  private stopTips() {
    if (this.tipTimer !== null) {
      clearTimeout(this.tipTimer);
      this.tipTimer = null;
    }
  }
}
