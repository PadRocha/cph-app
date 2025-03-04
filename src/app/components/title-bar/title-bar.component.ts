import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  HostListener,
  OnInit,
  resource,
  ResourceRef,
  signal,
  Signal,
  WritableSignal,
} from "@angular/core";
import { NgbDropdownModule } from "@ng-bootstrap/ng-bootstrap";
import { HistoryService, UserService } from "@core/services";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-title-bar",
  imports: [CommonModule, RouterLink, NgbDropdownModule],
  templateUrl: "./title-bar.component.html",
  styleUrl: "./title-bar.component.scss",
  host: {
    class: "d-flex justify-content-between align-items-center",
  },
})
export class TitleBarComponent {
  private window: Window;
  private maximizedResource: ResourceRef<boolean | undefined>;
  public isMaximized: Signal<boolean | undefined>;
  public dropdownVisible: boolean;
  public canGoBack: Signal<boolean>;
  public canGoForward: Signal<boolean>;
  public showDropdown: Signal<boolean>;
  public isCollapsed: WritableSignal<boolean>;

  constructor(private history: HistoryService, private user: UserService) {
    this.window = getCurrentWindow();
    this.maximizedResource = resource({
      loader: async () => await this.window.isMaximized(),
    });
    this.isMaximized = computed(this.maximizedResource.value);
    this.dropdownVisible = false;
    this.canGoBack = computed(() => this.history.index > 0);
    this.canGoForward = computed(
      () => this.history.index < this.history.getTrail().length - 1
    );
    this.showDropdown = computed(() => this.history.getTrail().length >= 3);
    this.isCollapsed = signal(true);
  }

  @HostListener("mousedown", ["$event"])
  async onMouseDown({
    target,
  }: MouseEvent & { target: HTMLElement }): Promise<void> {
    if (target.classList.contains("drag-handle")) {
      await this.window.startDragging();
      setTimeout(() => this.maximizedResource.reload(), 200);
    }
  }

  @HostListener("window:keydown.Meta")
  async onMetaKeyboard(): Promise<void> {
    setTimeout(() => this.maximizedResource.reload(), 300);
  }

  public async onMinimize(): Promise<void> {
    await this.window.minimize();
    // this.maximizedResource.reload();
  }

  public async onToggleMaximize(): Promise<void> {
    if (this.isMaximized()) await this.window.unmaximize();
    else await this.window.maximize();
    this.maximizedResource.reload();
  }

  public async onClose(): Promise<void> {
    await this.window.close();
  }

  public goBack(): void {
    this.history.goBack();
  }

  public goForward(): void {
    this.history.goForward();
  }

  public async onRefresh(): Promise<void> {
    this.history.reload();
    this.maximizedResource.reload();
  }

  public toggleDropdown(): void {
    this.dropdownVisible = !this.dropdownVisible;
  }

  public get partialHistory(): { route: string; index: number }[] {
    const hist = this.history.getTrail();
    const currentIndex = this.history.index;
    const range = 2;
    const start = Math.max(0, currentIndex - range);
    const end = Math.min(hist.length, currentIndex + range + 1);
    return hist
      .slice(start, end)
      .map((route, i) => ({ route, index: start + i }));
  }

  public isCurrent(index: number) {
    return index === this.history.index;
  }

  public navigateTo(index: number): void {
    this.history.index = index;
    this.dropdownVisible = false;
  }

  public get showLogin(): boolean {
    return !this.user.logged && this.history.url === "/pdf";
  }

  public get showLogout(): boolean {
    return this.user.logged && this.history.url !== "/login";
  }

  public get isAdmin(): boolean {
    return this.user.hasRole("GRANT", "ADMIN");
  }

  public onLogin() {}

  public onLogout(): void {
    this.user.destroy();
    this.user.logout();
  }

  public toggleNav(): void {
    this.isCollapsed.update((val) => !val);
  }
}
