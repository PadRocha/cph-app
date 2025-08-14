import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigKeysComponent } from './config-keys.component';

describe('ConfigKeysComponent', () => {
  let component: ConfigKeysComponent;
  let fixture: ComponentFixture<ConfigKeysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigKeysComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigKeysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
