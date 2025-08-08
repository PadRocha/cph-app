import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {
  private readonly _bottom = signal(false);
  public readonly isBottom = this._bottom.asReadonly();

  public set next(v: boolean) { 
    this._bottom.set(v); 
  }
}
