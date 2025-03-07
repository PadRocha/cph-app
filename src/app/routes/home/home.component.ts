import { Component } from '@angular/core';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-home',
  imports: [NgbTooltipModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  host: {
    class: 'd-block container'
  }
})
export class HomeComponent {

}
