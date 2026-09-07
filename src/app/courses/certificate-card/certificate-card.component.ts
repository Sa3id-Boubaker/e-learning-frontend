import { Component, Input, inject } from '@angular/core';

import { IconService } from '@ant-design/icons-angular';
import { SafetyCertificateOutline } from '@ant-design/icons-angular/icons';

import { SharedModule } from '../../theme/shared/shared.module';
import { CertificateResponse } from '../models/certificate.models';

/** Purely presentational — no service calls, no actions. Callers own any buttons around it. */
@Component({
  selector: 'app-certificate-card',
  imports: [SharedModule],
  templateUrl: './certificate-card.component.html',
  styleUrl: './certificate-card.component.scss'
})
export class CertificateCardComponent {
  private readonly iconService = inject(IconService);

  @Input({ required: true }) certificate!: CertificateResponse;

  constructor() {
    this.iconService.addIcon(...[SafetyCertificateOutline]);
  }
}
