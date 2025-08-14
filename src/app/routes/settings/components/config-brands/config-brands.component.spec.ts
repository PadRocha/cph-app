import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigBrandsComponent } from './config-brands.component';

describe('ConfigBrandsComponent', () => {
  let component: ConfigBrandsComponent;
  let fixture: ComponentFixture<ConfigBrandsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigBrandsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigBrandsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
