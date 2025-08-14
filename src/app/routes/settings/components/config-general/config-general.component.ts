import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { StorageService } from '@core/services/storage/storage.service';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';

type Mode = 'location';
type LocationScope = 'local' | 'session';

@Component({
  selector: 'config-general',
  imports: [NgbNavModule, ReactiveFormsModule],
  templateUrl: './config-general.component.html',
  styleUrl: './config-general.component.scss'
})
export class ConfigGeneralComponent {
  public readonly storageService = inject(StorageService);
  public subId = signal<Mode>('location');

  // Ruta (ya se autollenaba bien)
  public readonly locationForm = new FormControl(this.storageService.location, { nonNullable: true });
  private readonly locationChange = toSignal(
    this.locationForm.valueChanges.pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: this.locationForm.value }
  );

  // NUEVO: toggles con toSignal (antes NO reactivaban el effect)
  public readonly sendHeaderCtrl = new FormControl(this.storageService.sendLocationHeader, { nonNullable: true });
  public readonly scopeCtrl = new FormControl<LocationScope>(this.storageService.rememberLocation, { nonNullable: true });

  private readonly sendHeaderChange = toSignal(
    this.sendHeaderCtrl.valueChanges.pipe(startWith(this.sendHeaderCtrl.value), distinctUntilChanged()),
    { initialValue: this.sendHeaderCtrl.value }
  );

  private readonly scopeChange = toSignal(
    this.scopeCtrl.valueChanges.pipe(startWith(this.scopeCtrl.value), distinctUntilChanged()),
    { initialValue: this.scopeCtrl.value }
  );

  // Storage → form (sin bucles)
  private readonly _prefillFromStorage = effect(() => {
    const stored = this.storageService.location;
    if (this.locationForm.value !== stored) {
      this.locationForm.setValue(stored, { emitEvent: false });
    }
  });

  // form.ruta → storage
  private readonly _persistLocation = effect(() => {
    const value = this.locationChange();
    this.storageService.location = value; // escribe local/sessionStorage
  });

  // toggles → storage (AHORA sí es reactivo)
  private readonly _persistToggles = effect(() => {
    this.storageService.sendLocationHeader = this.sendHeaderChange(); // localStorage: location_send
    this.storageService.rememberLocation = this.scopeChange();        // localStorage: location_scope + migración de 'location'
  });

  public clearLocation(): void {
    this.storageService.clearLocation();
  }
}
