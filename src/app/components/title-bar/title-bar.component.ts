import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  HostListener,
  resource,
  ResourceRef,
  signal,
  Signal,
  WritableSignal,
} from "@angular/core";
import { NgbDropdownModule } from "@ng-bootstrap/ng-bootstrap";
import { NavigationService, Historian, UserService, StorageService } from "@core/services";
import { getCurrentWindow, Theme, Window } from "@tauri-apps/api/window";
import { RouterModule } from "@angular/router";

/**
 * Componente que representa la barra de título de la aplicación.
 *
 * Maneja acciones de ventana (minimizar, maximizar, cerrar) y navegación del historial.
 * Además, integra funcionalidades relacionadas con la sesión del usuario y el menú desplegable.
 */
@Component({
  selector: "app-title-bar",
  imports: [CommonModule, RouterModule, NgbDropdownModule],
  templateUrl: "./title-bar.component.html",
  styleUrl: "./title-bar.component.scss",
  host: {
    class: "d-flex justify-content-between align-items-center",
  },
})
export class TitleBarComponent {
  /** Referencia a la ventana actual obtenida mediante la API de Tauri. */
  private window: Window;

  /**
   * Recurso que mantiene el estado de si la ventana está maximizada.
   *
   * Se carga de forma asíncrona y se puede recargar.
   */
  private maximizedResource: ResourceRef<boolean | undefined>;

  /** Señal computada que indica si la ventana está maximizada. */
  public isMaximized: Signal<boolean | undefined>;

  /** Bandera que indica si el dropdown está visible. */
  public dropdownVisible: boolean;

  /** Señal computada que indica si se puede navegar hacia atrás en el historial. */
  // public canGoBack: Signal<boolean>;

  // /** Señal computada que indica si se puede navegar hacia adelante en el historial. */
  // public canGoForward: Signal<boolean>;

  /** Señal computada que indica si se debe mostrar el dropdown (basado en la longitud del historial). */
  public showDropdown: Signal<boolean>;

  /** Señal que indica si el menú lateral se encuentra colapsado. */
  public isCollapsed: WritableSignal<boolean>;

  /**
   * Crea una instancia de TitleBarComponent.
   *
   * @param history - Servicio de historial para la navegación.
   * @param user - Servicio de usuario para gestionar la sesión.
   */
  constructor(private navigation: NavigationService, private user: UserService, private storage: StorageService) {
    this.window = getCurrentWindow();
    this.maximizedResource = resource({
      loader: async () => await this.window.isMaximized(),
    });
    this.isMaximized = computed(this.maximizedResource.value);
    this.dropdownVisible = false;
    // this.canGoBack = computed(() => this.navigation.index > 0);
    // this.canGoForward = computed(
    //   () => this.navigation.index < this.navigation.history.length - 1
    // );
    this.showDropdown = computed(() => this.navigation.history.length >= 3);
    this.isCollapsed = signal(true);
  }

  /**
   * Maneja el evento mousedown sobre el componente.
   *
   * Si el objetivo contiene la clase 'drag-handle', inicia el arrastre de la ventana.
   *
   * @param event - Evento de mousedown con target tipado como HTMLElement.
   */
  @HostListener("mousedown", ["$event"])
  async onMouseDown({
    target,
  }: MouseEvent & { target: HTMLElement }): Promise<void> {
    if (target.classList.contains("drag-handle")) {
      await this.window.startDragging();
      setTimeout(() => this.maximizedResource.reload(), 200);
    }
  }

  /**
   * Maneja el evento de presionar la tecla Meta.
   *
   * Recarga el recurso de estado maximizado con un pequeño retardo.
   */
  @HostListener("window:keydown.Meta")
  async onMetaKeyboard(): Promise<void> {
    setTimeout(() => this.maximizedResource.reload(), 300);
  }

  /**
   * Minimiza la ventana actual.
   */
  public async onMinimize(): Promise<void> {
    await this.window.minimize();
  }

  /**
   * Alterna el estado maximizado de la ventana.
   *
   * Si la ventana está maximizada, la restaura; de lo contrario, la maximiza.
   * Luego recarga el recurso de estado.
   */
  public async onToggleMaximize(): Promise<void> {
    if (this.isMaximized()) await this.window.unmaximize();
    else await this.window.maximize();
    this.maximizedResource.reload();
  }

  /**
   * Cierra la ventana actual.
   */
  public async onClose(): Promise<void> {
    await this.window.close();
  }

  public canGoBack(): boolean {
    return this.navigation.hasPast;
  }

  public canGoForward(): boolean {
    return this.navigation.hasFuture;
  }

  /**
   * Navega hacia atrás en el historial.
   */
  public goBack(): void {
    this.navigation.goBack();
  }

  /**
   * Navega hacia adelante en el historial.
   */
  public goForward(): void {
    this.navigation.goForward();
  }

  /**
   * Recarga la vista actual y recarga el recurso de estado maximizado.
   */
  // public async onRefresh(): Promise<void> {
  //   this.navigation.reload();
  //   this.maximizedResource.reload();
  // }

  /**
   * Alterna la visibilidad del dropdown.
   */
  public toggleDropdown(): void {
    this.dropdownVisible = !this.dropdownVisible;
  }

  /**
   * Obtiene una porción del historial para mostrar en el dropdown.
   *
   * @returns Arreglo de objetos con la ruta y el índice en el historial.
   */
  public get partialHistory(): Historian[] {
    const hist = this.navigation.history;
    // const currentIndex = this.navigation.index;
    const currentIndex = this.navigation.now?.id ?? 0;
    const range = 4;
    const start = Math.max(0, currentIndex - range);
    const end = Math.min(hist.length, currentIndex + range + 1);
    return hist.slice(start, end);
  }

  public displayRoute({ base, params }: Historian) {
    const paramsEntries = Object.entries(params).filter(([_, value]) => value !== '' && value != -1);
    if (paramsEntries.length) {
      const paramsStr = paramsEntries
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      return `${base} { ${paramsStr} }`;
    }
    return base;
  }

  /**
   * Verifica si el índice proporcionado corresponde a la ruta actual.
   *
   * @param param0 - Objeto con la propiedad index.
   * @returns True si es la ruta actual, false en caso contrario.
   */
  public isCurrent({ id }: Historian): boolean {
    return this.navigation.now.id === id;
  }

  /**
   * Navega a la ruta correspondiente al índice proporcionado en el historial.
   *
   * @param param0 - Objeto con la propiedad index.
   */
  public navigateTo({ id }: Historian): void {
    this.navigation.now = id;
    this.dropdownVisible = false;
  }

  /**
   * Indica si se debe mostrar el botón de login.
   *
   * @returns True si el usuario no está logueado y la URL actual es "/pdf".
   */
  public get showLogin(): boolean {
    return !this.user.logged && this.navigation.now.route === "/pdf";
  }

  /**
   * Indica si se debe mostrar el botón de logout.
   *
   * @returns True si el usuario está logueado.
   */
  public get showLogout(): boolean {
    return this.user.logged;
  }

  /**
   * Verifica si el usuario tiene rol administrativo.
   *
   * @returns True si el usuario posee el rol "GRANT" o "ADMIN".
   */
  public get isAdmin(): boolean {
    return this.user.hasRole("GRANT", "ADMIN");
  }

  /**
   * Realiza el logout y destruye la sesión del usuario.
   */
  public onLogout(): void {
    this.user.destroy();
    this.user.logout();
  }

  /**
   * Alterna el estado del menú de navegación colapsado.
   */
  public toggleNav(): void {
    this.isCollapsed.update((val) => !val);
  }

  public get isDarkTheme(): boolean {
    return this.storage.theme === 'dark';
  }

  public toogleTheme(): void {
    this.storage.theme = this.isDarkTheme ? 'light' : 'dark';
  }
}
