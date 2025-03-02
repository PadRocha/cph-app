import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  HostListener,
  resource,
  ResourceRef,
  Signal,
} from "@angular/core";
import { NgbDropdownModule } from "@ng-bootstrap/ng-bootstrap";
import { HistoryService } from "@core/services";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";

@Component({
  selector: "app-title-bar",
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: "./title-bar.component.html",
  styleUrl: "./title-bar.component.scss",
  host: {
    class: "d-flex justify-content-between align-items-center px-2 py-1",
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

  constructor(private history: HistoryService) {
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
  }

  @HostListener("mousedown", ["$event"])
  async onMouseDown({ target }: MouseEvent & { target: HTMLElement }): Promise<void> {
    if (target.classList.contains("drag-handle")) {
      await this.window.startDragging();
      setTimeout(() => this.maximizedResource.reload(), 200);
    }
  }

  public async onMinimize(): Promise<void> {
    await this.window.minimize();
    this.maximizedResource.reload();
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
}
