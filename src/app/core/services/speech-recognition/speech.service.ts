import { inject, Injectable, NgZone, OnDestroy, Signal, signal } from '@angular/core';
import { fromEvent, map, Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SpeechService implements OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  private readonly recognition = new this.speech();
  private _listening = signal(false);
  public readonly isListening = this._listening.asReadonly();
  private readonly _transcript = signal('');
  public readonly transcript = this._transcript.asReadonly();
  private readonly result$ = fromEvent<SpeechRecognitionEvent>(this.recognition, 'result')
    .pipe(
      map(({ results }) => {
        let text = '';
        for (const res of Array.from(results)) text += res[0].transcript;
        return text.trim();
      })
    );
  private readonly end$ = fromEvent(this.recognition, 'end');
  private readonly error$ = fromEvent<SpeechRecognitionErrorEvent>(this.recognition, 'error')
  private subs = new Subscription();

  constructor() {
    if (!this.speech) {
      throw new Error('SpeechRecognition no soportada en este navegador');
    }

    this.recognition.lang = 'es-MX';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.ngZone.runOutsideAngular(() => {
      this.subs.add(this.result$.subscribe((text) => this._transcript.set(text)));
      this.subs.add(this.end$.subscribe(() => this._transcript.set('')));
      this.subs.add(this.error$.subscribe(({ error }) => console.error('Speech error:', error)))
    });
  }

  public start(): void {
    if (this._listening()) return;
    this.ngZone.runOutsideAngular(() => this.recognition.start());
    this._listening.set(true);
  }

  public stop(): void {
    if (!this._listening()) return;
    this.ngZone.runOutsideAngular(() => this.recognition.stop());
    this._listening.set(false);
  }

  public toggle(): void {
    this._listening() ? this.stop() : this.start();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
