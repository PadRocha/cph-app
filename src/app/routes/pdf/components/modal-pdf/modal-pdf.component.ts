import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  OnDestroy,
} from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Search } from '@pdf/models';
import { ItemService } from '@pdf/services';
import { Subscription } from 'rxjs';
import { ThemeDirective } from '@shared/directives';

@Component({
  selector: 'app-modal-pdf',
  standalone: true,
  templateUrl: './modal-pdf.component.html',
  styleUrl: './modal-pdf.component.scss',
  hostDirectives: [ThemeDirective],
})
export class ModalPdfComponent implements OnDestroy {
  private readonly itemService = inject(ItemService);
  private readonly active = inject(NgbActiveModal);
  private readonly sanitizer = inject(DomSanitizer);

  public readonly params = input.required<Search>();
  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);

  private sub?: Subscription;
  private objectUrl: string | null = null;

  public readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  public readonly hasPdf = computed(() => !!this.pdfUrl());

  // tips rotativos para amenizar la espera
  private readonly tips = [
    "Preparando consulta…",
    "Inicializando servicio de búsqueda…",
    "Estableciendo conexión HTTP…",
    "Negociando cabeceras y compresión…",
    "Esperando disponibilidad del servidor…",
    "Asignando identificador de trabajo…",
    "Solicitando PDF al servidor…",
    "Resolviendo búsqueda y parámetros…",
    "Construyendo agregación de consulta…",
    "Consultando y agrupando items…",
    "Calculando secciones y paginado…",
    "Verificando rutas y assets requeridos…",
    "Inicializando stream y documento PDF…",
    "Preparando índice de contenidos…",
    "Dibujando encabezados y pies de página…",
    "Componiendo cuadrícula de productos…",
    "Resolviendo imágenes y tipografías…",
    "Escribiendo códigos y descripciones…",
    "Paginando siguiente sección…",
    "Actualizando totales visibles…",
    "Abriendo nueva sección…",
    "Abriendo nueva página de sección…",
    "Calculando posición de celda…",
    "Localizando imagen de producto…",
    "Cargando imagen desde disco…",
    "Renderizando imagen de producto…",
    "Aplicando marcador de imagen faltante…",
    "Trazando marco de imagen…",
    "Escribiendo código del producto…",
    "Trazando marco de código…",
    "Escribiendo descripción del producto…",
    "Trazando marco de descripción…",
    "Avanzando a siguiente celda…",
    "Saltando a siguiente fila…",
    "Completando página de sección…",
    "Completando sección…",
    "Esperando drenaje del stream…",
    "Vaciando buffers pendientes…",
    "Comprimiendo y cerrando el documento…",
    "Ordenando bits por color…",
    "Convenciendo a los píxeles tímidos…",
    "Afilando tipografías sin cortar papel…",
    "Quitando pelusas al búfer…",
    "Último sorbo de café para la CPU…",
  ] as const;
  public readonly tip = signal<typeof this.tips[number]>(this.tips[0]);
  private tipTimer: number | null = null;
  private tipIndex = 0;
  private tipsSeen = 0;

  public readonly _ = effect(() => {
    const p = this.params();
    this.loadPdf(p);
  });

  public loadPdf(params: Search) {
    this.cleanupUrl();
    this.sub?.unsubscribe();
    this.startTips();

    this.loading.set(true);
    this.error.set(null);
    this.pdfUrl.set(null);

    this.sub = this.itemService
      .getPdf({ search: params.search, status: params.status })
      .subscribe({
        next: ({ done, data }) => {
          if (done && data) {
            const url = URL.createObjectURL(
              new Blob([data], { type: 'application/pdf' }),
            );
            this.objectUrl = url;
            this.pdfUrl.set(
              this.sanitizer.bypassSecurityTrustResourceUrl(url),
            );
          }
        },
        error: () => this.error.set('Ocurrió un error al descargar el PDF'),
      });

    this.sub.add(() => {
      this.stopTips();
      this.loading.set(false);
    });
  }

  public retry() {
    this.loadPdf(this.params());
  }

  public downloadPdf() {
    if (!this.objectUrl) return;
    const a = document.createElement('a');
    a.href = this.objectUrl;
    const search = this.params().search || 'sin_busqueda';
    a.download = `catalogo_${search}_${Date.now()}.pdf`;
    a.click();
  }

  public close() {
    this.sub?.unsubscribe();
    this.cleanupUrl();
    this.stopTips();
    return this.active.dismiss();
  }

  ngOnDestroy(): void {
    this.cleanupUrl();
    this.stopTips();
  }

  private cleanupUrl() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private startTips() {
    this.stopTips();
    this.tipIndex = 0;
    this.tipsSeen = 0;
    this.tip.set(this.tips[this.tipIndex]);
    this.scheduleNextTip();
  }

  private scheduleNextTip() {
    const base = 3_000;     // inicio: 3s
    const step = 500;       // incremento por tip: +0.5s
    const max = 12_000;     // tope opcional: 12s
    const jitter = 0;       // si quieres variación: Math.random() * 300 - 150

    const delay = Math.min(base + this.tipsSeen * step, max) + jitter;

    this.tipTimer = window.setTimeout(() => {
      this.tipIndex = (this.tipIndex + 1) % this.tips.length;
      this.tip.set(this.tips[this.tipIndex]);
      this.tipsSeen++;
      this.scheduleNextTip(); // programa el siguiente con el nuevo delay
    }, Math.max(0, delay));
  }

  private stopTips() {
    if (this.tipTimer !== null) {
      clearInterval(this.tipTimer);
      this.tipTimer = null;
    }
  }
}
