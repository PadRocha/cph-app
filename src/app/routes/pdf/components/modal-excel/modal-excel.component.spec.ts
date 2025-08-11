import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalExcelComponent } from './modal-excel.component';

describe('ModalExcelComponent', () => {
  let component: ModalExcelComponent;
  let fixture: ComponentFixture<ModalExcelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalExcelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalExcelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
