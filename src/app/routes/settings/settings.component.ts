import { Component, signal } from '@angular/core';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ConfigBrandsComponent, ConfigGeneralComponent, ConfigKeysComponent, ConfigLinesComponent, ConfigUsersComponent } from './components';

@Component({
  selector: 'app-settings',
  imports: [NgbNavModule, ConfigGeneralComponent, ConfigKeysComponent, ConfigLinesComponent, ConfigBrandsComponent, ConfigUsersComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  host: { class: 'd-block container pb-3' },
})
export class SettingsComponent {
  public activeId = signal(1);
}
