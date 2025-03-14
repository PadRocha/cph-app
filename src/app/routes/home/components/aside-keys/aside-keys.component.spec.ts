import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsideKeysComponent } from './aside-keys.component';

describe('AsideKeysComponent', () => {
  let component: AsideKeysComponent;
  let fixture: ComponentFixture<AsideKeysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsideKeysComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AsideKeysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
