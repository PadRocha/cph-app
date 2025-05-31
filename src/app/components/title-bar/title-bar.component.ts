
import { Component, computed, HostListener, inject, resource, signal } from "@angular/core";
import { NgbDropdownModule } from "@ng-bootstrap/ng-bootstrap";
import { NavigationService, Historian, UserService, StorageService } from "@core/services";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { RouterLink, RouterLinkActive } from "@angular/router";

/**
 * Componente que representa la barra de título de la aplicación.
 *
 * Maneja acciones de ventana (minimizar, maximizar, cerrar) y navegación del historial.
 * Además, integra funcionalidades relacionadas con la sesión del usuario y el menú desplegable.
 */
@Component({
  selector: "app-title-bar",
  imports: [RouterLink, RouterLinkActive, NgbDropdownModule],
  templateUrl: "./title-bar.component.html",
  styleUrl: "./title-bar.component.scss",
  host: {
    class: "d-flex justify-content-between align-items-center",
  },
})
export class TitleBarComponent {
  private readonly navigation = inject(NavigationService);
  private readonly user = inject(UserService);
  private readonly storage = inject(StorageService);
  private readonly window = getCurrentWindow();

  public dropdownVisible = false;
  
  private maximizedResource = resource({
    loader: async () => await this.window.isMaximized(),
  });;
  public isMaximized = computed(this.maximizedResource.value);
  public showDropdown = computed(() => this.navigation.history.length >= 3);
  public isCollapsed = signal(true);

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
