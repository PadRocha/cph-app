import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigLinesComponent } from './config-lines.component';

describe('ConfigLinesComponent', () => {
  let component: ConfigLinesComponent;
  let fixture: ComponentFixture<ConfigLinesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigLinesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigLinesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
