import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterLink } from '@angular/router';

import { IconDirective, IconService } from '@ant-design/icons-angular';
import { CompassOutline } from '@ant-design/icons-angular/icons';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-not-found',
  imports: [CommonModule, RouterLink, IconDirective, TranslatePipe],
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.scss']
})
export class NotFoundComponent {
  private readonly location = inject(Location);
  private readonly iconService = inject(IconService);

  constructor() {
    this.iconService.addIcon(...[CompassOutline]);
  }

  goBack(): void {
    this.location.back();
  }
}
