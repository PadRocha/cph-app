import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalItemComponent } from './modal-item.component';

describe('ModalItemComponent', () => {
  let component: ModalItemComponent;
  let fixture: ComponentFixture<ModalItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
