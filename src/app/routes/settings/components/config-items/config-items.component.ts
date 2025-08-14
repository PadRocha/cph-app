import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbNavModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { IKey, Key } from '@settings/models';
import { BrandService, KeyService, LineService } from '@settings/services';
import { debounceTime, distinctUntilChanged, map, Observable, startWith, switchMap } from 'rxjs';

@Component({
  selector: 'config-items',
  standalone: true,
  imports: [NgbNavModule, NgbTypeaheadModule, ReactiveFormsModule],
  templateUrl: './config-items.component.html',
  styleUrls: ['./config-items.component.scss'],
})
export class ConfigItemsComponent {
}
