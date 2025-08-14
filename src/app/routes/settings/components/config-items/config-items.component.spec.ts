import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigItemsComponent } from './config-items.component';

describe('ConfigItemsComponent', () => {
  let component: ConfigItemsComponent;
  let fixture: ComponentFixture<ConfigItemsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigItemsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
