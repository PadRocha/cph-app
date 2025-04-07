import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalImageItemComponent } from './modal-image-item.component';

describe('ModalImageItemComponent', () => {
  let component: ModalImageItemComponent;
  let fixture: ComponentFixture<ModalImageItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalImageItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalImageItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
