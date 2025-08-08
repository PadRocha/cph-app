import { Component, effect, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Search, status } from '@home/models';
import { DecimalPipe } from '@angular/common';
import { StatusButtonDirective } from '@home/directives';
import { ItemService } from '@home/services';
import { SpeechService } from '@core/services/speech-recognition/speech.service';

type SearchControls = {
  [K in keyof Search]: FormControl<Search[K]>;
};

@Component({
  selector: 'item-search',
  imports: [DecimalPipe, StatusButtonDirective, ReactiveFormsModule],
  templateUrl: './item-search.component.html',
  styleUrl: './item-search.component.scss'
})
export class ItemSearchComponent implements OnInit {
  private readonly itemService = inject(ItemService);
  private readonly speechService = inject(SpeechService);
  public readonly statusList: status[] = [1, 2, 3, 4, 5];
  
  public searchForm = new FormGroup<SearchControls>({
    search: new FormControl("", { nonNullable: true }),
    status: new FormControl(-1, { nonNullable: true }),
  });
  public searchChange = effect(() => {
    const search = this.itemService.searchParams;
    this.searchForm.patchValue(search, { emitEvent: false });
  });
  public transcriptChange = effect(() => {
    const text = this.speechService.transcript();
    if (text && this.listening) {
      this.searchForm.patchValue({ search: text });
    }
  });
  public get listening() {
    return this.speechService.isListening();
  }
  public toggleRecorder() {
    this.speechService.toggle();
    const input = this.searchForm.controls.search;
    this.listening ? input.disable() : input.enable();
  }

  ngOnInit(): void {
    const search = this.itemService.searchParams;
    this.searchForm.patchValue(search, { emitEvent: false });
    this.searchForm.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
      )
      .subscribe(() => {
        this.itemService.searchParams = this.searchForm.getRawValue();
      });
  }


  public get success(): number {
    return this.itemService.total;
  }

  public get percentage(): number {
    return this.itemService.percentage;
  }

  public setStatus(status: status): void {
    const statusForm = this.searchForm.get("status");
    if (status === 0 || statusForm === null) return;
    if (statusForm.value == status) return this.searchForm.patchValue({ status: -1 });
    this.searchForm.patchValue({ status });
  }

  public get activeStatus() {
    return this.searchForm.get('status')?.value ?? -1;
  }
}
